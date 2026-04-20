// Drawing service - temporarily disabled
export const drawingService = {
  createRoom: async () => null,
  joinRoom: async () => null,
  initChannel: async () => {},
  subscribeToRoom: () => () => {},
  submitDrawing: async () => {},
  submitVote: async () => {},
  toggleReady: async () => {},
  startDrawingGame: async () => {},
  updateDrawingIndex: async () => {},
  moveToVoting: async () => {},
  revealDrawing: async () => {},
  calculateRoundScores: async () => {},
  nextRound: async () => {},
  getFinalRanking: async () => [],
  getRoomSubmissions: async () => [],
  getSubmissionVotes: async () => [],
  leaveRoom: async () => {},
  getCurrentRoomId: () => null,
  getLocalPlayerId: () => null,
  isHost: () => false,
  getRoom: async () => null,
  startDiscoveryListener: async () => {},
  stopDiscoveryListener: () => {},
  deleteRoom: async () => {},
};
export type DrawingPlayer = any;
export type DrawingRoom = any;
export type DrawingSubmission = any;
export type DrawingVote = any;