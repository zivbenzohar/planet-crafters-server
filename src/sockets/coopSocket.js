const coopService = require("../../services/coopService");

module.exports = (io) => {
  io.on('connection', (socket) => {

    socket.on('joinCoop', (data) => {
      coopService.handleJoin(io, socket, data);
    });

    socket.on('playerStateCoop', (data) => {
      coopService.handlePlayerState(io, socket, data);
    });

    socket.on('playerActionCoop', (data) => {
      coopService.handlePlayerAction(io, socket, data);
    });

    socket.on('disconnect', () => {
      coopService.handleDisconnect(io, socket);
    });
  });
};
