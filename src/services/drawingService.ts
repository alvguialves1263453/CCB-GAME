// Drawing service - temporarily disabled
export const drawingService = {
  createRoom: async (..._args: any[]) => null,
  joinRoom: async (..._args: any[]) => null,
  initChannel: async (..._args: any[]) => {},
  subscribeToRoom: (..._args: any[]) => () => {},
  submitDrawing: async (..._args: any[]) => {},
  submitVote: async (..._args: any[]) => {},
  toggleReady: async (..._args: any[]) => {},
  startDrawingGame: async (..._args: any[]) => {},
  updateDrawingIndex: async (..._args: any[]) => {},
  moveToVoting: async (..._args: any[]) => {},
  revealDrawing: async (..._args: any[]) => {},
  calculateRoundScores: async (..._args: any[]) => {},
  nextRound: async (..._args: any[]) => {},
  getFinalRanking: async (..._args: any[]) => [],
  getRoomSubmissions: async (..._args: any[]) => [],
  getSubmissionVotes: async (..._args: any[]) => [],
  leaveRoom: async (..._args: any[]) => {},
  getCurrentRoomId: (..._args: any[]) => null,
  getLocalPlayerId: (..._args: any[]) => null,
  isHost: (..._args: any[]) => false,
  getRoom: async (..._args: any[]) => null,
  startDiscoveryListener: async (..._args: any[]) => {},
  stopDiscoveryListener: (..._args: any[]) => {},
  deleteRoom: async (..._args: any[]) => {},
};
export type DrawingPlayer = any;
export type DrawingRoom = any;
export type DrawingSubmission = any;
export type DrawingVote = any;