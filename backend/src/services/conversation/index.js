'use strict';

module.exports = {
  processMessage: require('./processMessage').processMessage,
  resolveWaitAckMessage: require('./core').resolveWaitAckMessage,
  tryHandlePresenceResponse: require('./core').tryHandlePresenceResponse,
};
