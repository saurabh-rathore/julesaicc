const AsteriskManager = require('asterisk-manager');
const EventEmitter = require('events');
require('dotenv').config(); // To get AMI credentials

const AMI_PORT = process.env.AMI_PORT || 5038;
const AMI_HOST = process.env.AMI_HOST || 'localhost';
const AMI_USERNAME = process.env.AMI_USERNAME;
const AMI_PASSWORD = process.env.AMI_PASSWORD;

class AmiService extends EventEmitter {
  constructor() {
    super();
    this.ami = null;
    this.isConnected = false;
    this.shouldAttemptReconnect = true;
    this.reconnectInterval = 5000; // 5 seconds
  }

  connect() {
    if (this.isConnected) {
      console.log('AMI Service: Already connected.');
      return;
    }

    if (!AMI_USERNAME || !AMI_PASSWORD) {
      console.error('AMI Service Error: AMI username or password not configured in .env file.');
      this.emit('error', new Error('AMI credentials not configured.'));
      // Optionally, schedule a retry if config might appear later, or just stop.
      // For now, we won't auto-retry on config errors.
      this.shouldAttemptReconnect = false;
      return;
    }

    console.log(`AMI Service: Attempting to connect to ${AMI_HOST}:${AMI_PORT}`);
    this.ami = new AsteriskManager(AMI_PORT, AMI_HOST, AMI_USERNAME, AMI_PASSWORD, true);

    // Keep Alive messages // TODO: Check if this is still needed or handled by the library
    // this.ami.keepConnected();

    this.ami.on('managerevent', (evt) => {
      // console.log('AMI Event:', JSON.stringify(evt, null, 2));
      this.emit('ami_event', evt); // Emit all events for other services to consume

      // Specific event handling can be done here or by listeners
      if (evt.event === 'Newchannel') {
        this.emit('new_channel', evt);
      }
      // Add more specific event emits if needed:
      // e.g., Hangup, Newstate, VarSet, etc.
    });

    this.ami.on('connect', () => {
      this.isConnected = true;
      this.shouldAttemptReconnect = true; // Reset for future disconnections
      console.log('AMI Service: Successfully connected to Asterisk.');
      this.emit('connect');

      // Example: Listen for specific events if not handled by 'managerevent' broadly
      // this.ami.action({
      //   'action': 'events',
      //   'eventmask': 'on' // or specific events: system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate
      // }, (err, res) => {
      //   if (err) console.error('AMI Service: Error enabling events', err);
      //   else console.log('AMI Service: Event listening enabled', res);
      // });
    });

    this.ami.on('error', (err) => {
      console.error('AMI Service Error:', err);
      this.isConnected = false;
      this.emit('error', err);
      if (this.shouldAttemptReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ami.on('close', () => {
      console.log('AMI Service: Connection closed.');
      this.isConnected = false;
      this.emit('close');
      if (this.shouldAttemptReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ami.on('disconnect', () => {
      console.log('AMI Service: Disconnected.');
      this.isConnected = false;
      this.emit('disconnect');
      if (this.shouldAttemptReconnect) {
        this.scheduleReconnect();
      }
    });

    // Login action (optional, some libraries do this automatically on connect)
    // The 'asterisk-manager' library typically handles login on instantiation if credentials are provided.
    // If not, you might need:
    // this.ami.action({
    //   'action': 'login',
    //   'username': AMI_USERNAME,
    //   'secret': AMI_PASSWORD
    // }, (err, res) => {
    //   if (err) {
    //     console.error('AMI Service: Login failed', err);
    //     this.emit('error', new Error('AMI Login failed'));
    //     if (this.ami) this.ami.disconnect();
    //   } else {
    //     console.log('AMI Service: Login successful', res);
    //   }
    // });
  }

  scheduleReconnect() {
    if (!this.shouldAttemptReconnect) {
        console.log('AMI Service: Reconnect disabled.');
        return;
    }
    console.log(`AMI Service: Attempting to reconnect in ${this.reconnectInterval / 1000} seconds...`);
    setTimeout(() => {
      if (this.shouldAttemptReconnect && !this.isConnected) {
        this.connect();
      }
    }, this.reconnectInterval);
  }

  disconnect(graceful = true) {
    console.log('AMI Service: Disconnecting...');
    this.shouldAttemptReconnect = !graceful; // Don't reconnect if it's a graceful shutdown
    if (this.ami) {
      this.ami.disconnect(); // This should trigger 'close' or 'disconnect' event
    }
    this.isConnected = false;
  }

  /**
   * Sends an action to the Asterisk Manager Interface.
   * @param {object} action - The action object to send.
   * @param {function} [callback] - Optional callback function (err, response).
   * @returns {Promise<object>} A promise that resolves with the AMI response if no callback is provided.
   */
  sendAction(action, callback) {
    if (!this.ami || !this.isConnected) {
      const error = new Error('AMI Service: Not connected to Asterisk.');
      if (callback) return callback(error);
      return Promise.reject(error);
    }

    if (callback && typeof callback === 'function') {
        this.ami.action(action, callback);
    } else {
        return new Promise((resolve, reject) => {
            this.ami.action(action, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }
  }
}

// Export a singleton instance
const amiServiceInstance = new AmiService();
module.exports = amiServiceInstance;
