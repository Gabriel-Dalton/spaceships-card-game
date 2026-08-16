"""Who is sitting at the table.

Every policy takes a batch of positions and returns one action per position, so
a policy is a function over thousands of simultaneous games rather than over a
single one. Illegal actions are masked before the choice is made, and a position
with nothing legal at all (no card to draw, no bank to fire) returns -1, a pass.

Three hand-written ships to measure against, and one that learns:

  RandomPolicy      uniform over legal actions -- the floor.
  HeuristicPolicy   the policy the analysis scripts use, and the thing to beat.
  GreedyPolicy      fires whenever it can; the impatient play the rules punish.
  MLPPolicy         a small tanh network over the public features, whose weights
                    ``train.py`` searches. A bank of parameter sets can be held
                    at once so a whole generation shares one batch of games.
"""

from __future__ import annotations

import numpy as np

from .engine import (ATTACK, CHARGE, CHARGE_ATTACK, N_ACTIONS, N_FEATURES,
                     SWAP_SELF, SWAP_TARGET)


def _masked_choice(scores, legal, rng, temperature=1.0):
    """Sample one legal action per row from ``scores``; -1 if none is legal."""
    scores = np.where(legal, scores, -np.inf)
    none = ~legal.any(1)
    if temperature <= 0:
        pick = np.argmax(np.where(legal, scores, -np.inf), axis=1)
    else:
        z = scores / temperature
        z -= np.where(np.isfinite(z), z, -np.inf).max(1, keepdims=True)
        p = np.exp(np.where(np.isfinite(z), z, -np.inf))
        total = p.sum(1, keepdims=True)
        p = np.where(total > 0, p / np.maximum(total, 1e-12), 0.0)
        u = rng.random(len(scores))
        pick = (np.cumsum(p, axis=1) <= u[:, None]).sum(1)
        pick = np.minimum(pick, N_ACTIONS - 1)
    return np.where(none, -1, pick).astype(np.int32)


class Policy:
    """``act`` sees only what the table sees.

    ``obs`` is [n, N_FEATURES], ``legal`` is [n, N_ACTIONS], ``view`` is the
    same position unnormalised and named, and ``rows`` is the global game index
    of each position -- needed only by policies whose weights vary per game.
    """

    name = "policy"

    def act(self, obs, legal, view, rng, rows=None):
        raise NotImplementedError


class RandomPolicy(Policy):
    name = "random"

    def act(self, obs, legal, view, rng, rows=None):
        return _masked_choice(np.zeros_like(legal, dtype=np.float64), legal, rng)


class GreedyPolicy(Policy):
    """Fire at the first opportunity, charge only when there is nothing to fire.

    Included because the design notes predict it loses: attacking off the top of
    the deck is worth about zero damage against a healthy shield.
    """

    name = "greedy"

    def act(self, obs, legal, view, rng, rows=None):
        scores = np.zeros((len(obs), N_ACTIONS))
        scores[:, CHARGE_ATTACK] = 3.0
        scores[:, ATTACK] = 2.0
        scores[:, CHARGE] = 1.0
        return _masked_choice(scores, legal, rng, temperature=0.0)


class HeuristicPolicy(Policy):
    """The reference play from analysis/reshuffle.py, action for action.

    Repair a bad shield first, take the free disarm shot when somebody is
    sitting on a bank behind a soft shield, cash in at three charges or when the
    expected total is already lethal, otherwise bank.
    """

    name = "heuristic"

    def __init__(self, repair_below=5, bank_target=3, disarm_at=3):
        self.repair_below = repair_below
        self.bank_target = bank_target
        self.disarm_at = disarm_at

    def act(self, obs, legal, view, rng, rows=None):
        n = len(obs)
        scores = np.full((n, N_ACTIONS), -1.0)
        own_s = view["own_shield"]
        own_c = view["own_charges"]
        t_s = view["tgt_shield"]
        t_c = view["tgt_charges"]
        t_h = view["tgt_health"]

        repair = own_s <= self.repair_below
        disarm = (~repair) & (t_c >= self.disarm_at) & (t_s <= 7)
        lethal = 7 * (own_c + 1) >= t_h + t_s
        cash = (~repair) & (~disarm) & ((own_c >= self.bank_target)
                                        | ((own_c >= 1) & lethal))
        bank = ~(repair | disarm | cash)

        scores[repair, SWAP_SELF] = 10.0
        scores[disarm, ATTACK] = 10.0        # plain attack: costs our bank nothing
        scores[cash, CHARGE_ATTACK] = 10.0
        scores[bank, CHARGE] = 10.0
        # Fallbacks in the order the rules make sensible, if the first pick is
        # illegal -- e.g. cashing in with no bank left after being disarmed.
        scores[:, CHARGE] = np.maximum(scores[:, CHARGE], 1.0)
        scores[:, ATTACK] = np.maximum(scores[:, ATTACK], 0.5)
        scores[:, CHARGE_ATTACK] = np.maximum(scores[:, CHARGE_ATTACK], 0.25)
        scores[:, SWAP_SELF] = np.maximum(scores[:, SWAP_SELF], 0.1)
        scores[:, SWAP_TARGET] = np.maximum(scores[:, SWAP_TARGET], 0.0)
        return _masked_choice(scores, legal, rng, temperature=0.0)


# --------------------------------------------------------------- the learner

class MLPPolicy(Policy):
    """features -> tanh(hidden) -> one score per action.

    ``params`` has a leading axis of *variants*. Holding a bank of parameter
    sets in one policy object is what lets a whole ES generation -- and a whole
    league of past snapshots -- share a single batch of games: each row carries
    the index of the variant sitting in that seat.
    """

    name = "mlp"

    def __init__(self, params, hidden=32, row_variant=None, temperature=1.0,
                 name=None):
        self.params = np.atleast_2d(np.asarray(params, dtype=np.float64))
        self.hidden = hidden
        # row_variant[game] -> index into params. None means one set for all.
        self.row_variant = None if row_variant is None else np.asarray(row_variant)
        self.temperature = temperature
        if name:
            self.name = name

    # -- parameter vector layout ------------------------------------------
    @staticmethod
    def n_params(hidden=32, n_features=N_FEATURES, n_actions=N_ACTIONS):
        return n_features * hidden + hidden + hidden * n_actions + n_actions

    @classmethod
    def initial(cls, hidden=32, rng=None, scale=0.5):
        rng = rng if rng is not None else np.random.default_rng()
        theta = rng.normal(0.0, scale, size=cls.n_params(hidden))
        theta /= np.sqrt(N_FEATURES)
        return theta

    def _unpack(self, theta):
        h, f, a = self.hidden, N_FEATURES, N_ACTIONS
        i = 0
        W1 = theta[..., i:i + f * h].reshape(*theta.shape[:-1], f, h); i += f * h
        b1 = theta[..., i:i + h]; i += h
        W2 = theta[..., i:i + h * a].reshape(*theta.shape[:-1], h, a); i += h * a
        b2 = theta[..., i:i + a]
        return W1, b1, W2, b2

    def scores(self, obs, rows=None):
        if self.row_variant is None or len(self.params) == 1:
            W1, b1, W2, b2 = self._unpack(self.params[0])
            return np.tanh(obs @ W1 + b1) @ W2 + b2
        variants = self.row_variant[rows]
        out = np.empty((len(obs), N_ACTIONS))
        for v in np.unique(variants):
            sel = np.flatnonzero(variants == v)
            W1, b1, W2, b2 = self._unpack(self.params[v])
            out[sel] = np.tanh(obs[sel] @ W1 + b1) @ W2 + b2
        return out

    def act(self, obs, legal, view, rng, rows=None):
        return _masked_choice(self.scores(obs, rows), legal, rng,
                              self.temperature)
