import type { GameCommand } from './commands'

// Historical level-5 trace from the real Cookierift 83 vs. 1035 deck opening.
// Keeping the parent commands fixed lets this test exercise the FLIP interruption
// independently of later, valid AI strategy improvements.
export const AI_FLIP_SEQUENCE_PARENT_COMMANDS = [
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "place-support",
    "playerId": "player-one",
    "instanceId": "player-one-BS12-013-1"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "activate-skill",
    "playerId": "player-one",
    "sourceInstanceId": "player-one-BS12-016-2",
    "trigger": "activate",
    "paymentIds": [],
    "costSupportToTrashIds": [],
    "supportToHandIds": [],
    "discardHandIds": [],
    "hpToTrashTargetIds": [],
    "trashBattleCookieIds": [],
    "battleToHandIds": [],
    "trashToDeckBottomIds": [],
    "trashToDeckIds": [],
    "effectTargets": [
      [],
      [
        "player-one-BS12-016-2"
      ]
    ],
    "trashCookieToBreakAreaIds": [],
    "handToBreakAreaIds": [],
    "chooseOneModes": []
  },
  {
    "kind": "deploy-cookie",
    "playerId": "player-one",
    "instanceId": "player-one-BS12-016-1"
  },
  {
    "kind": "activate-skill",
    "playerId": "player-one",
    "sourceInstanceId": "player-one-BS12-016-1",
    "trigger": "activate",
    "paymentIds": [],
    "costSupportToTrashIds": [],
    "supportToHandIds": [],
    "discardHandIds": [],
    "hpToTrashTargetIds": [],
    "trashBattleCookieIds": [],
    "battleToHandIds": [],
    "trashToDeckBottomIds": [],
    "trashToDeckIds": [],
    "effectTargets": [
      [
        "player-one-BS12-016-2"
      ],
      [
        "player-one-BS12-016-1"
      ]
    ],
    "trashCookieToBreakAreaIds": [],
    "handToBreakAreaIds": [],
    "chooseOneModes": []
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "place-support",
    "playerId": "player-two",
    "instanceId": "player-two-BS1-050-1"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "play-stage",
    "playerId": "player-two",
    "instanceId": "player-two-BS11-028-3",
    "paymentIds": [
      "player-two-BS1-050-1"
    ]
  },
  {
    "kind": "deploy-cookie",
    "playerId": "player-two",
    "instanceId": "player-two-ST7-008-1"
  },
  {
    "kind": "skip-on-play",
    "playerId": "player-two",
    "sourceInstanceId": "player-two-ST7-008-1"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "place-support",
    "playerId": "player-one",
    "instanceId": "player-one-BS1-023-1"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "activate-skill",
    "playerId": "player-one",
    "sourceInstanceId": "player-one-BS12-016-1",
    "trigger": "activate",
    "paymentIds": [],
    "costSupportToTrashIds": [],
    "supportToHandIds": [],
    "discardHandIds": [],
    "hpToTrashTargetIds": [],
    "trashBattleCookieIds": [],
    "battleToHandIds": [],
    "trashToDeckBottomIds": [],
    "trashToDeckIds": [],
    "effectTargets": [
      [
        "player-one-BS12-016-2"
      ],
      [
        "player-one-BS12-016-1"
      ]
    ],
    "trashCookieToBreakAreaIds": [],
    "handToBreakAreaIds": [],
    "chooseOneModes": []
  },
  {
    "kind": "activate-skill",
    "playerId": "player-one",
    "sourceInstanceId": "player-one-BS12-016-2",
    "trigger": "activate",
    "paymentIds": [],
    "costSupportToTrashIds": [],
    "supportToHandIds": [],
    "discardHandIds": [],
    "hpToTrashTargetIds": [],
    "trashBattleCookieIds": [],
    "battleToHandIds": [],
    "trashToDeckBottomIds": [],
    "trashToDeckIds": [],
    "effectTargets": [
      [
        "player-one-BS12-016-1"
      ],
      [
        "player-one-BS12-016-2"
      ]
    ],
    "trashCookieToBreakAreaIds": [],
    "handToBreakAreaIds": [],
    "chooseOneModes": []
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "place-support",
    "playerId": "player-two",
    "instanceId": "player-two-BS4-038-1"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "declare-attack",
    "playerId": "player-two",
    "attackerInstanceId": "player-two-P-152-1",
    "targetInstanceId": "player-one-BS12-016-1",
    "supportPaymentIds": [
      "player-two-BS1-050-1",
      "player-two-BS4-038-1"
    ]
  },
  {
    "kind": "skip-trap",
    "playerId": "player-one"
  },
  {
    "kind": "resolve-next-damage",
    "playerId": "player-one"
  },
  {
    "kind": "resolve-next-damage",
    "playerId": "player-one"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "place-support",
    "playerId": "player-one",
    "instanceId": "player-one-BS12-013-2"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "activate-skill",
    "playerId": "player-one",
    "sourceInstanceId": "player-one-BS12-016-1",
    "trigger": "activate",
    "paymentIds": [],
    "costSupportToTrashIds": [],
    "supportToHandIds": [],
    "discardHandIds": [],
    "hpToTrashTargetIds": [],
    "trashBattleCookieIds": [],
    "battleToHandIds": [],
    "trashToDeckBottomIds": [],
    "trashToDeckIds": [],
    "effectTargets": [
      [
        "player-one-BS12-016-2"
      ],
      [
        "player-one-BS12-016-1"
      ]
    ],
    "trashCookieToBreakAreaIds": [],
    "handToBreakAreaIds": [],
    "chooseOneModes": []
  },
  {
    "kind": "declare-attack",
    "playerId": "player-one",
    "attackerInstanceId": "player-one-BS12-016-2",
    "targetInstanceId": "player-two-P-152-1",
    "supportPaymentIds": [
      "player-one-BS12-013-1",
      "player-one-BS1-023-1",
      "player-one-BS12-013-2"
    ]
  },
  {
    "kind": "skip-trap",
    "playerId": "player-two"
  },
  {
    "kind": "resolve-next-damage",
    "playerId": "player-two"
  },
  {
    "kind": "resolve-attack-effect",
    "playerId": "player-one",
    "targetIds": []
  },
  {
    "kind": "replace-cookie",
    "playerId": "player-two",
    "instanceId": "player-two-ST7-008-2"
  },
  {
    "kind": "skip-on-play",
    "playerId": "player-two",
    "sourceInstanceId": "player-two-ST7-008-2"
  },
  {
    "kind": "activate-skill",
    "playerId": "player-one",
    "sourceInstanceId": "player-one-BS12-016-2",
    "trigger": "activate",
    "paymentIds": [],
    "costSupportToTrashIds": [],
    "supportToHandIds": [],
    "discardHandIds": [],
    "hpToTrashTargetIds": [],
    "trashBattleCookieIds": [],
    "battleToHandIds": [],
    "trashToDeckBottomIds": [],
    "trashToDeckIds": [],
    "effectTargets": [
      [
        "player-one-BS12-016-1"
      ],
      [
        "player-one-BS12-016-2"
      ]
    ],
    "trashCookieToBreakAreaIds": [],
    "handToBreakAreaIds": [],
    "chooseOneModes": []
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-one"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "place-support",
    "playerId": "player-two",
    "instanceId": "player-two-P-152-2"
  },
  {
    "kind": "advance-phase",
    "playerId": "player-two"
  },
  {
    "kind": "declare-attack",
    "playerId": "player-two",
    "attackerInstanceId": "player-two-ST7-008-1",
    "targetInstanceId": "player-one-BS12-016-1",
    "supportPaymentIds": [
      "player-two-BS1-050-1",
      "player-two-BS4-038-1",
      "player-two-P-152-2"
    ]
  },
  {
    "kind": "skip-trap",
    "playerId": "player-one"
  },
  {
    "kind": "resolve-next-damage",
    "playerId": "player-one"
  },
  {
    "kind": "resolve-flip",
    "playerId": "player-one",
    "activate": false,
    "discardHandIds": []
  },
  {
    "kind": "resolve-next-damage",
    "playerId": "player-one"
  },
  {
    "kind": "resolve-flip",
    "playerId": "player-one",
    "activate": true,
    "discardHandIds": [],
    "targetIds": [
      "player-two-ST7-008-1"
    ]
  },
  {
    "kind": "resolve-next-damage",
    "playerId": "player-two"
  },
  {
    "kind": "resolve-flip",
    "playerId": "player-two",
    "activate": true,
    "discardHandIds": [],
    "targetIds": [
      "player-two-ST7-008-1"
    ]
  },
  {
    "kind": "resolve-draw-up-to",
    "playerId": "player-two",
    "drawCount": 1
  },
  {
    "kind": "resolve-next-damage",
    "playerId": "player-two"
  }
] satisfies readonly GameCommand[]
