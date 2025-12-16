const soloService = require("../../services/soloService");
module.exports = (io) => {
  io.on('connection', (socket) => {

    socket.on('joinSolo', (data) => {
      soloService.handleJoin(io, socket, data);
    });

    socket.on('soloState', (data) => {
      soloService.handleState(io, socket, data);
    });

    socket.on('disconnect', () => {
      soloService.handleDisconnect(io, socket);
    });
  });
};
