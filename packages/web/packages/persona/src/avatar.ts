// The persona toolkit's avatar behavior + animation engine, re-published from
// its owner. See ./chat.ts for why consumers must not name
// `@agenticdevelopertoolkit/*` directly.
//
// This one matters more than the others, not less. The engine hands out live
// refs and drives them with GSAP on a shared ticker; a second copy of it in a
// bundle is not a duplicated module, it is a second animation loop writing to
// half the rig.

export {
  useAvatarEngine,
  useBlink,
  useIdleLadder,
  useSpeech,
  useArbitration,
  useGaze,
  useIdleFidget,
  useSpeechBubble,
  applyPose,
  DEFAULT_TUNING,
} from '@agenticdevelopertoolkit/avatar'

export type {
  AvatarEngine,
  AvatarEngineConfig,
  Choreography,
  ExpressionEffect,
  MoodMap,
  WakingConfig,
  ArbitrationConfig,
  Arbitration,
  GazeOptions,
  IdleFidgetOptions,
  AvatarDriverProps,
  Pose,
  AvatarRig,
  Ref,
  EyesChannel,
  IrisChannel,
  AntennaeChannel,
  BrowsChannel,
  MouthChannel,
  DescenderChannel,
  FaceChannel,
  Tuning,
  Ladder,
} from '@agenticdevelopertoolkit/avatar'
