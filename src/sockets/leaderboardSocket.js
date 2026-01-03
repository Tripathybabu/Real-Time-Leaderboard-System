const leaderboardService = require('../services/leaderboardService');

function registerLeaderboardSocket(io) {
  io.on('connection', (socket) => {
    console.log('Client connected', socket.id);

    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
    });

    socket.on('leaderboard:join', ({ region, mode }) => {
      if (!mode) return;
      socket.join(`room:mode:${mode}`);
      if (region) {
        socket.join(`room:region:${region}:mode:${mode}`);
      }
    });

    socket.on('score:update', async (payload, cb) => {
      try {
        const result = await leaderboardService.updateScore(payload);
        const { playerId, region, mode, globalScore, regionScore } = result;

        io.to(`room:mode:${mode}`).emit('score:updated', {
          playerId,
          region,
          mode,
          globalScore,
          regionScore
        });

        if (region) {
          io.to(`room:region:${region}:mode:${mode}`).emit('score:updated', {
            playerId,
            region,
            mode,
            globalScore,
            regionScore
          });
        }

        if (typeof cb === 'function') {
          cb({ ok: true, data: result });
        }
      } catch (err) {
        console.error('Error in score:update', err);
        if (typeof cb === 'function') {
          cb({ ok: false, error: err.message || 'Internal error' });
        }
      }
    });

    socket.on('leaderboard:getTop', async ({ region, mode, limit }, cb) => {
      try {
        const top = await leaderboardService.getTop({ region, mode, limit });
        if (typeof cb === 'function') {
          cb({ ok: true, data: top });
        }
      } catch (err) {
        console.error('Error in leaderboard:getTop', err);
        if (typeof cb === 'function') {
          cb({ ok: false, error: err.message || 'Internal error' });
        }
      }
    });
  });
}

module.exports = registerLeaderboardSocket;
