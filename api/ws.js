"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports2, module2) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module2.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
      kListener: Symbol("kListener"),
      kStatusCode: Symbol("status-code"),
      kWebSocket: Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports2, module2) {
    "use strict";
    var { websocketMask, websocketUnmask } = require("http");
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module2.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (websocketMask) {
      module2.exports.mask = function(source, mask, output, offset, length) {
        if (length < 24) _mask(source, mask, output, offset, length);
        else websocketMask(source, mask, output, offset, length);
      };
      module2.exports.unmask = function(buffer, mask) {
        if (buffer.length < 24) _unmask(buffer, mask);
        else websocketUnmask(buffer, mask);
      };
    } else if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = require("bufferutil");
        module2.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module2.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports2, module2) {
    "use strict";
    var kDone = Symbol("kDone");
    var kRun = Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module2.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports2, module2) {
    "use strict";
    var zlib = require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = Symbol("permessage-deflate");
    var kTotalLength = Symbol("total-length");
    var kCallback = Symbol("callback");
    var kBuffers = Symbol("buffers");
    var kError = Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module2.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports2, module2) {
    "use strict";
    var { isUtf8 } = require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module2.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module2.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = require("utf-8-validate");
        module2.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports2, module2) {
    "use strict";
    var { Writable } = require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        this._mask = void 0;
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module2.exports = Receiver2;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports2, module2) {
    "use strict";
    var { Duplex } = require("stream");
    var { randomFillSync } = require("crypto");
    var {
      types: { isUint8Array }
    } = require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) {
          return dataLength ? [target, data] : [target];
        }
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (!dataLength) return [target];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module2.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports2, module2) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = Symbol("kCode");
    var kData = Symbol("kData");
    var kError = Symbol("kError");
    var kMessage = Symbol("kMessage");
    var kReason = Symbol("kReason");
    var kTarget = Symbol("kTarget");
    var kType = Symbol("kType");
    var kWasClean = Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module2.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module2.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var https = require("https");
    var http = require("http");
    var net = require("net");
    var querystring = require("querystring");
    var tls = require("tls");
    var { randomBytes: randomBytes2, createHash } = require("crypto");
    var { Duplex, Readable } = require("stream");
    var { URL } = require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module2.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        parsedUrl = new URL(parsedUrl);
        parsedUrl.protocol = parsedUrl.protocol === "http:" ? "ws:" : "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes2(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        const username = querystring.unescape(parsedUrl.username);
        const password = querystring.unescape(parsedUrl.password);
        opts.auth = `${username}:${password}`;
      }
      if (isIpcUrl) {
        const i = opts.path.indexOf(":");
        if (i === -1) {
          opts.socketPath = opts.path;
          opts.path = "";
        } else {
          opts.socketPath = opts.path.slice(0, i);
          opts.path = opts.path.slice(i + 1);
        }
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeCode = code;
      if (reason.length === 0) {
        websocket._closeMessage = EMPTY_BUFFER;
      } else {
        websocket._closeMessage = Buffer.allocUnsafeSlow(reason.length);
        websocket._closeMessage.set(reason);
      }
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports2, module2) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module2.exports = createWebSocketStream2;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module2.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var http = require("http");
    var { Duplex } = require("stream");
    var { createHash } = require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer3 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server2 = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server2.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module2.exports = WebSocketServer3;
    function addListeners(server2, map) {
      for (const event of Object.keys(map)) server2.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server2.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server2) {
      server2._state = CLOSED;
      server2.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server2, req, socket, code, message, headers) {
      if (server2.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server2.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// server/src/vercel.ts
var vercel_exports = {};
__export(vercel_exports, {
  default: () => vercel_default
});
module.exports = __toCommonJS(vercel_exports);
var import_node_http = require("node:http");

// node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// shared/src/rng.ts
var Rng = class {
  s;
  constructor(seed) {
    this.s = seed >>> 0;
  }
  /** Flottant dans [0, 1). */
  next() {
    this.s = this.s + 1831565813 >>> 0;
    let t = this.s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /** Entier dans [min, max] inclus. */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** État interne, pour sauvegarder/restaurer. */
  get state() {
    return this.s;
  }
};
function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function deriveSeed(seed, attempt) {
  return hashSeed(`${seed >>> 0}:${attempt}`);
}

// shared/src/map/types.ts
var cellIndex = (map, x, y) => y * map.width + x;
var inBounds = (map, x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height;

// shared/src/config/map.ts
var MAP_CONFIG = {
  width: 24,
  height: 16,
  /** Distance horizontale entre deux virages du chemin (min, max). */
  segmentLength: [3, 5],
  /** Probabilité d'avoir un second point d'apparition qui rejoint le chemin principal. */
  secondPathChance: 0.5,
  /** Nombre d'emplacements constructibles (min, max). */
  slots: [26, 34],
  /** Part des emplacements en hauteur (bonus de portée). */
  highGroundRatio: 0.2,
  highGroundRangeBonus: 0.2,
  /** Tronçons de boue sur le chemin (ralentit les ennemis). */
  mudPatches: [1, 3],
  mudPatchLength: [2, 4],
  mudSlowFactor: 0.65,
  /** Gisements de ressources (min, max) et leur contenu. */
  deposits: [3, 5],
  depositMinDistFromPath: 2,
  /** Zones de prospection : proches du chemin, donc dangereuses. */
  prospectZones: [1, 2],
  /** Rochers infranchissables pour le héros (min, max). */
  rocks: [8, 16],
  /** Critères de validation. */
  minPathLength: 30,
  minSlots: 20,
  maxAttempts: 50
};

// shared/src/map/validate.ts
function reachableFrom(grid, from) {
  const { width: W, height: H, terrain } = grid;
  const start = from.y * W + from.x;
  const seen = /* @__PURE__ */ new Set([start]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % W;
    const y = Math.floor(i / W);
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (terrain[n] === "rock" || seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}
function validateMap(map, cfg = MAP_CONFIG) {
  const errors = [];
  const { width: W, height: H, terrain } = map;
  const at = (c) => terrain[c.y * W + c.x];
  if (terrain.length !== W * H) errors.push("terrain de taille incorrecte");
  if (map.paths.length === 0) errors.push("aucun chemin");
  map.paths.forEach((path, p) => {
    const last = path[path.length - 1];
    if (!last || last.x !== map.base.x || last.y !== map.base.y) errors.push(`chemin ${p} : n'arrive pas \xE0 la base`);
    if (path.length < cfg.minPathLength) errors.push(`chemin ${p} : trop court (${path.length})`);
    const seen = /* @__PURE__ */ new Set();
    for (let i = 0; i < path.length; i++) {
      const c = path[i];
      if (c.x < 0 || c.y < 0 || c.x >= W || c.y >= H) errors.push(`chemin ${p} : case hors carte`);
      else if (at(c) !== "path") errors.push(`chemin ${p} : case non marqu\xE9e comme chemin`);
      const key = c.y * W + c.x;
      if (seen.has(key)) errors.push(`chemin ${p} : repasse sur lui-m\xEAme`);
      seen.add(key);
      if (i > 0) {
        const prev = path[i - 1];
        if (Math.abs(prev.x - c.x) + Math.abs(prev.y - c.y) !== 1) errors.push(`chemin ${p} : discontinu \xE0 l'\xE9tape ${i}`);
      }
    }
  });
  if (map.slots.length < cfg.minSlots) errors.push(`pas assez d'emplacements (${map.slots.length})`);
  for (const s of map.slots) if (at(s) !== "slot") errors.push(`emplacement ${s.id} mal plac\xE9`);
  if (map.deposits.length < cfg.deposits[0]) errors.push(`pas assez de gisements (${map.deposits.length})`);
  if (map.prospectZones.length < cfg.prospectZones[0]) errors.push("pas de zone de prospection");
  const reach = reachableFrom(map, map.base);
  const ok = (c) => reach.has(c.y * W + c.x);
  for (const s of map.slots) if (!ok(s)) errors.push(`emplacement ${s.id} inaccessible`);
  for (const d of map.deposits) if (!ok(d) || at(d) !== "ground") errors.push(`gisement ${d.id} inaccessible`);
  for (const z of map.prospectZones) if (!ok(z) || at(z) !== "ground") errors.push(`zone de prospection ${z.id} inaccessible`);
  return errors;
}

// shared/src/map/generate.ts
function generateMap(requestedSeed, cfg = MAP_CONFIG) {
  const errorsSeen = [];
  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    const seed = attempt === 0 ? requestedSeed >>> 0 : deriveSeed(requestedSeed, attempt);
    const map = buildMap(seed, cfg);
    map.requestedSeed = requestedSeed >>> 0;
    map.attempt = attempt;
    const errors = validateMap(map, cfg);
    if (errors.length === 0) return map;
    errorsSeen.push(...errors);
  }
  throw new Error(`Impossible de g\xE9n\xE9rer une carte valide (seed ${requestedSeed}) : ${errorsSeen.slice(0, 5).join(" ; ")}`);
}
function buildMap(seed, cfg) {
  const rng = new Rng(seed);
  const { width: W, height: H } = cfg;
  const terrain = new Array(W * H).fill("ground");
  const idx = (x, y) => y * W + x;
  const main = walkPath(rng, cfg, rng.int(2, H - 3), null, W - 1);
  const paths = [main];
  if (rng.chance(cfg.secondPathChance)) {
    const mainIndex = /* @__PURE__ */ new Map();
    main.forEach((c, i) => mainIndex.set(idx(c.x, c.y), i));
    const candidates = [];
    for (let y = 1; y < H - 1; y++) if (Math.abs(y - main[0].y) >= 4) candidates.push(y);
    if (candidates.length > 0) {
      const mergeX = rng.int(Math.floor(W / 3), Math.floor(2 * W / 3));
      const second = walkPath(rng, cfg, rng.pick(candidates), mainIndex, mergeX);
      const last = second[second.length - 1];
      const joinAt = mainIndex.get(idx(last.x, last.y));
      if (joinAt !== void 0) paths.push([...second, ...main.slice(joinAt + 1)]);
    }
  }
  for (const p of paths) for (const c of p) terrain[idx(c.x, c.y)] = "path";
  const dist2 = distanceToPath(terrain, W, H);
  const slotCells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dist2[idx(x, y)] === 1) slotCells.push({ x, y });
  rng.shuffle(slotCells);
  const slotCount = Math.min(slotCells.length, rng.int(cfg.slots[0], cfg.slots[1]));
  const slots = slotCells.slice(0, slotCount).map((c, id) => {
    terrain[idx(c.x, c.y)] = "slot";
    return { id, x: c.x, y: c.y, high: rng.chance(cfg.highGroundRatio) };
  });
  const mud = /* @__PURE__ */ new Set();
  const patches = rng.int(cfg.mudPatches[0], cfg.mudPatches[1]);
  for (let i = 0; i < patches; i++) {
    const len = rng.int(cfg.mudPatchLength[0], cfg.mudPatchLength[1]);
    const start = rng.int(3, Math.max(3, main.length - 4 - len));
    for (let k = start; k < Math.min(main.length - 3, start + len); k++) mud.add(idx(main[k].x, main[k].y));
  }
  const prospectCells = slotCells.slice(slotCount).filter((c) => c.x < W / 2 && c.x > 0);
  const prospectCount = Math.min(prospectCells.length, rng.int(cfg.prospectZones[0], cfg.prospectZones[1]));
  const prospectZones = prospectCells.slice(0, prospectCount).map((c, id) => ({ id, x: c.x, y: c.y }));
  const reserved = new Set(prospectZones.map((z) => idx(z.x, z.y)));
  const far = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (dist2[idx(x, y)] > cfg.depositMinDistFromPath) far.push({ x, y });
  rng.shuffle(far);
  const depositTarget = rng.int(cfg.deposits[0], cfg.deposits[1]);
  const deposits = [];
  for (const minGap of [5, 3, 1]) {
    for (const c of far) {
      if (deposits.length >= depositTarget) break;
      if (reserved.has(idx(c.x, c.y))) continue;
      if (deposits.every((d) => Math.max(Math.abs(d.x - c.x), Math.abs(d.y - c.y)) >= minGap)) {
        deposits.push({ id: deposits.length, x: c.x, y: c.y });
        reserved.add(idx(c.x, c.y));
      }
    }
  }
  const rockCells = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (terrain[i] === "ground" && dist2[i] >= 2 && !reserved.has(i)) rockCells.push({ x, y });
    }
  rng.shuffle(rockCells);
  const rockTarget = rng.int(cfg.rocks[0], cfg.rocks[1]);
  const base2 = main[main.length - 1];
  let rocks = 0;
  for (const c of rockCells) {
    if (rocks >= rockTarget) break;
    const i = idx(c.x, c.y);
    terrain[i] = "rock";
    const walkable = terrain.filter((t) => t !== "rock").length;
    if (reachableFrom({ width: W, height: H, terrain }, base2).size === walkable) rocks++;
    else terrain[i] = "ground";
  }
  return {
    requestedSeed: seed,
    seed,
    attempt: 0,
    width: W,
    height: H,
    terrain,
    paths,
    mud: [...mud].sort((a, b) => a - b),
    slots,
    deposits,
    prospectZones,
    spawns: paths.map((p) => p[0]),
    base: base2
  };
}
function walkPath(rng, cfg, startY, stopOn, endX) {
  const { width: W, height: H } = cfg;
  const cells = [{ x: 0, y: startY }];
  let x = 0;
  let y = startY;
  const hit = () => stopOn !== null && stopOn.has(y * W + x);
  const push = () => {
    cells.push({ x, y });
    return hit();
  };
  while (x < endX) {
    let nx = Math.min(endX, x + rng.int(cfg.segmentLength[0], cfg.segmentLength[1]));
    if (endX - nx < 2) nx = endX;
    while (x < nx) {
      x++;
      if (push()) return cells;
    }
    let ny;
    if (x >= endX) {
      if (stopOn === null) break;
      let best = -1;
      for (let yy = 0; yy < H; yy++)
        if (stopOn.has(yy * W + x) && (best < 0 || Math.abs(yy - y) < Math.abs(best - y))) best = yy;
      if (best < 0) break;
      ny = best;
    } else {
      const options = [];
      for (let yy = 1; yy < H - 1; yy++) if (Math.abs(yy - y) >= 2) options.push(yy);
      ny = rng.pick(options);
    }
    while (y !== ny) {
      y += ny > y ? 1 : -1;
      if (push()) return cells;
    }
  }
  return cells;
}
function distanceToPath(terrain, W, H) {
  const dist2 = new Array(W * H).fill(Infinity);
  const queue = [];
  terrain.forEach((t, i) => {
    if (t === "path") {
      dist2[i] = 0;
      queue.push(i);
    }
  });
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const cx = i % W;
    const cy = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!inBounds({ width: W, height: H }, nx, ny)) continue;
        const n = cellIndex({ width: W }, nx, ny);
        if (dist2[n] > dist2[i] + 1) {
          dist2[n] = dist2[i] + 1;
          queue.push(n);
        }
      }
  }
  return dist2;
}

// shared/src/config/towers.ts
var base = (s) => ({
  maxHp: 100,
  damage: 10,
  range: 3,
  minRange: 0,
  cooldown: 1,
  splash: 0,
  slow: 0,
  slowDuration: 0,
  dot: 0,
  dotDuration: 0,
  pierceShield: false,
  ammo: 0,
  repairCostMult: 1,
  chain: 0,
  chainRange: 0,
  chainFalloff: 0.75,
  ramp: 0,
  rampMax: 0,
  critChance: 0,
  critMult: 1,
  auraRadius: 0,
  auraDamage: 0,
  auraRate: 0,
  auraReach: 0,
  auraHeal: 0,
  income: 0,
  ...s
});
var TOWERS = {
  canon: {
    id: "canon",
    name: "Canon \xE0 plasma",
    desc: "Tourelle polyvalente.",
    cost: 50,
    base: base({ maxHp: 120, damage: 12, range: 3.2, cooldown: 0.9 }),
    nodes: [
      { id: "artillerie", name: "Artillerie", desc: "D\xE9g\xE2ts de zone, cadence lente.", cost: 60, parent: null, stats: { damage: 16, splash: 1.2, cooldown: 1.6 } },
      { id: "precision", name: "Pr\xE9cision", desc: "Gros d\xE9g\xE2ts sur une cible, longue port\xE9e.", cost: 60, parent: null, stats: { damage: 42, range: 5, cooldown: 1.8 } },
      { id: "rafale", name: "Rafale", desc: "Cadence tr\xE8s haute, courte port\xE9e.", cost: 60, parent: null, stats: { damage: 7, range: 2.5, cooldown: 0.25 } },
      { id: "explosive", name: "Explosive", desc: "Zone \xE9largie, mais r\xE9paration deux fois plus ch\xE8re.", cost: 120, parent: "artillerie", stats: { damage: 30, splash: 1.8, repairCostMult: 2 } },
      { id: "incendiaire", name: "Incendiaire", desc: "Br\xFBle sur la dur\xE9e et ignore les boucliers.", cost: 110, parent: "artillerie", stats: { dot: 10, dotDuration: 4, pierceShield: true } },
      { id: "mortier", name: "Mortier", desc: "Port\xE9e \xE9norme, mais aveugle de pr\xE8s.", cost: 110, parent: "artillerie", stats: { damage: 34, range: 7, minRange: 2.5, cooldown: 2.2 } },
      { id: "perforant", name: "Perforant", desc: "Ignore les boucliers. Fragile.", cost: 110, parent: "precision", stats: { damage: 70, pierceShield: true, maxHp: 80 } },
      { id: "chasseur", name: "Chasseur", desc: "D\xE9g\xE2ts massifs, tr\xE8s lent, cher \xE0 r\xE9parer.", cost: 130, parent: "precision", stats: { damage: 160, cooldown: 3.2, repairCostMult: 1.6 } },
      { id: "mitrailleuse", name: "Mitrailleuse", desc: "Cadence extr\xEAme, mais consomme des munitions.", cost: 110, parent: "rafale", stats: { damage: 9, cooldown: 0.12, ammo: 400 } },
      { id: "blindee", name: "Blind\xE9e", desc: "Robuste et \xE9conomique \xE0 r\xE9parer, frappe moins fort.", cost: 90, parent: "rafale", stats: { maxHp: 320, damage: 8, repairCostMult: 0.6 } },
      // Niveau 4
      { id: "thermobare", name: "Thermobare", desc: "Souffle d\xE9vastateur sur une grande zone. R\xE9paration tr\xE8s ch\xE8re.", cost: 170, parent: "explosive", stats: { damage: 58, splash: 2.4, cooldown: 2.2, repairCostMult: 2.5 } },
      { id: "brasier", name: "Brasier", desc: "Br\xFBlure intense sur une grande zone, ignore les boucliers.", cost: 150, parent: "incendiaire", stats: { dot: 24, dotDuration: 5, splash: 1.5 } },
      { id: "saturation", name: "Saturation", desc: "Pilonne une large zone, de tr\xE8s loin.", cost: 150, parent: "mortier", stats: { damage: 36, splash: 1.7, range: 8, cooldown: 1.7 } },
      { id: "elite", name: "Tireur d\u2019\xE9lite", desc: "Tir perforant, 30 % de coups critiques (x3).", cost: 160, parent: "perforant", stats: { damage: 110, critChance: 0.3, critMult: 3, range: 6 } },
      { id: "executeur", name: "Ex\xE9cuteur", desc: "Tir \xE9norme, 40 % de coups critiques (x2).", cost: 170, parent: "chasseur", stats: { damage: 250, cooldown: 3.8, critChance: 0.4, critMult: 2, repairCostMult: 1.8 } },
      { id: "tempete-plomb", name: "Temp\xEAte de plomb", desc: "Cadence d\xE9mentielle, grosse r\xE9serve de munitions.", cost: 150, parent: "mitrailleuse", stats: { damage: 11, cooldown: 0.08, ammo: 700 } },
      { id: "forteresse", name: "Forteresse", desc: "Presque indestructible et tr\xE8s \xE9conomique \xE0 r\xE9parer.", cost: 130, parent: "blindee", stats: { maxHp: 600, damage: 10, range: 3, repairCostMult: 0.45 } }
    ]
  },
  givre: {
    id: "givre",
    name: "\xC9metteur cryo",
    desc: "Ralentit les ennemis, peu de d\xE9g\xE2ts.",
    cost: 60,
    base: base({ maxHp: 90, damage: 4, range: 2.8, cooldown: 1.1, slow: 0.3, slowDuration: 1.5 }),
    nodes: [
      { id: "blizzard", name: "Blizzard", desc: "Ralentit toute une zone.", cost: 70, parent: null, stats: { splash: 1.5, slow: 0.35, slowDuration: 2 } },
      { id: "glace-vive", name: "Glace vive", desc: "Ralentissement fort sur une cible, avec des d\xE9g\xE2ts.", cost: 70, parent: null, stats: { damage: 22, slow: 0.55, slowDuration: 2.5 } },
      { id: "tempete", name: "Temp\xEAte", desc: "Zone immense. Tr\xE8s fragile.", cost: 120, parent: "blizzard", stats: { splash: 2.4, range: 3.4, maxHp: 60 } },
      { id: "permafrost", name: "Permafrost", desc: "Ralentissement plus long, tour robuste.", cost: 100, parent: "blizzard", stats: { slowDuration: 4, maxHp: 180, repairCostMult: 0.7 } },
      { id: "eclat", name: "\xC9clat", desc: "Gros d\xE9g\xE2ts de glace, cher \xE0 r\xE9parer.", cost: 120, parent: "glace-vive", stats: { damage: 60, repairCostMult: 1.8 } },
      { id: "entrave", name: "Entrave", desc: "Immobilise presque la cible.", cost: 110, parent: "glace-vive", stats: { slow: 0.8, slowDuration: 2, cooldown: 1.6 } },
      { id: "gel-toxique", name: "Gel toxique", desc: "Givre corrosif : ralentit et br\xFBle sur la dur\xE9e.", cost: 70, parent: null, stats: { damage: 6, slow: 0.3, slowDuration: 2, dot: 8, dotDuration: 5, splash: 0.9 } },
      { id: "corrosion", name: "Corrosion", desc: "Acide plus fort, ignore boucliers et armures.", cost: 110, parent: "gel-toxique", stats: { dot: 18, dotDuration: 5, pierceShield: true } },
      { id: "contagion", name: "Contagion", desc: "Zone plus large et plus de port\xE9e, effets plus l\xE9gers.", cost: 110, parent: "gel-toxique", stats: { splash: 1.8, dot: 10, range: 3.2 } },
      // Niveau 4
      { id: "age-glaciaire", name: "\xC2ge glaciaire", desc: "Zone gigantesque, fort ralentissement.", cost: 160, parent: "tempete", stats: { splash: 3.2, slow: 0.5, slowDuration: 3, range: 3.6, damage: 8 } },
      { id: "cryostase", name: "Cryostase", desc: "Ralentit \xE9norm\xE9ment et longtemps. Tour robuste.", cost: 140, parent: "permafrost", stats: { slow: 0.65, slowDuration: 5, maxHp: 240 } },
      { id: "zero-absolu", name: "Z\xE9ro absolu", desc: "D\xE9g\xE2ts de glace perforants. R\xE9paration tr\xE8s ch\xE8re.", cost: 170, parent: "eclat", stats: { damage: 130, slow: 0.6, pierceShield: true, repairCostMult: 2.2 } },
      { id: "stase", name: "Stase", desc: "Quasi-arr\xEAt de toute une zone pendant un instant.", cost: 150, parent: "entrave", stats: { slow: 0.95, slowDuration: 1.3, cooldown: 2.2, splash: 1.1 } },
      { id: "necrose", name: "N\xE9crose", desc: "Une br\xFBlure d\xE9vorante qui ronge m\xEAme les blind\xE9s.", cost: 150, parent: "corrosion", stats: { dot: 40, dotDuration: 6 } }
    ]
  },
  baliste: {
    id: "baliste",
    name: "Canon \xE0 rails",
    desc: "Tr\xE8s puissante, mais \xE0 munitions limit\xE9es : le h\xE9ros doit la recharger.",
    cost: 80,
    base: base({ maxHp: 100, damage: 55, range: 4.5, cooldown: 1.5, ammo: 24 }),
    nodes: [
      { id: "lourde", name: "Lourde", desc: "D\xE9g\xE2ts doubl\xE9s, moins de munitions.", cost: 80, parent: null, stats: { damage: 120, ammo: 14, cooldown: 2 } },
      { id: "repetition", name: "\xC0 r\xE9p\xE9tition", desc: "Tir rapide, grande r\xE9serve.", cost: 80, parent: null, stats: { damage: 40, cooldown: 0.7, ammo: 50 } },
      { id: "siege", name: "De si\xE8ge", desc: "Tueuse de boss. R\xE9paration tr\xE8s ch\xE8re.", cost: 140, parent: "lourde", stats: { damage: 320, cooldown: 3, ammo: 10, repairCostMult: 2 } },
      { id: "eclats", name: "\xC0 \xE9clats", desc: "Le carreau explose en zone.", cost: 120, parent: "lourde", stats: { splash: 1.4 } },
      { id: "autonome", name: "Autonome", desc: "Munitions illimit\xE9es, d\xE9g\xE2ts r\xE9duits.", cost: 130, parent: "repetition", stats: { damage: 28, ammo: 0 } },
      { id: "harpon", name: "Harpon", desc: "Ralentit la cible touch\xE9e.", cost: 110, parent: "repetition", stats: { slow: 0.4, slowDuration: 1.5 } },
      { id: "perforatrice", name: "Perforatrice", desc: "Perce boucliers et armures.", cost: 90, parent: null, stats: { damage: 85, pierceShield: true, ammo: 22, cooldown: 2 } },
      { id: "rail-magnetique", name: "Rail magn\xE9tique", desc: "Tr\xE8s longue port\xE9e, gros d\xE9g\xE2ts perforants.", cost: 130, parent: "perforatrice", stats: { damage: 140, range: 6.5, ammo: 14, cooldown: 2.4 } },
      { id: "desintegrateur", name: "D\xE9sint\xE9grateur", desc: "Cadence plus \xE9lev\xE9e, perce toujours.", cost: 120, parent: "perforatrice", stats: { damage: 70, cooldown: 1.1, ammo: 40 } },
      // Niveau 4
      { id: "orbital", name: "Frappe orbitale", desc: "Un seul tir par recharge, mais il rase un boss.", cost: 200, parent: "siege", stats: { damage: 700, ammo: 6, cooldown: 5, range: 6, repairCostMult: 2.5 } },
      { id: "grappe", name: "Grappe", desc: "Explosion en zone tr\xE8s large.", cost: 160, parent: "eclats", stats: { damage: 160, splash: 2.2, ammo: 12 } },
      { id: "gatling", name: "Gatling \xE0 rails", desc: "Cadence soutenue, sans munitions.", cost: 160, parent: "autonome", stats: { damage: 34, cooldown: 0.5 } },
      { id: "chaine", name: "Cha\xEEne", desc: "Entrave fortement la cible touch\xE9e.", cost: 140, parent: "harpon", stats: { damage: 50, slow: 0.75, slowDuration: 2.2 } },
      { id: "gauss", name: "Canon de Gauss", desc: "Port\xE9e extr\xEAme, d\xE9g\xE2ts perforants \xE9normes.", cost: 170, parent: "rail-magnetique", stats: { damage: 380, range: 8, ammo: 8, cooldown: 3.6, repairCostMult: 1.8 } },
      { id: "fission", name: "Fission", desc: "Tirs perforants qui explosent un peu en zone.", cost: 150, parent: "desintegrateur", stats: { damage: 95, cooldown: 0.9, ammo: 40, splash: 0.8 } }
    ]
  },
  foudre: {
    id: "foudre",
    name: "Bobine Tesla",
    desc: "L\u2019\xE9clair saute d\u2019un ennemi \xE0 l\u2019autre.",
    cost: 60,
    base: base({ maxHp: 95, damage: 17, range: 2.9, cooldown: 1, chain: 2, chainRange: 1.6, chainFalloff: 0.75 }),
    nodes: [
      { id: "arc-long", name: "Arc long", desc: "Plus de rebonds, plus loin.", cost: 70, parent: null, stats: { damage: 16, chain: 4, chainRange: 2, range: 3 } },
      { id: "haute-tension", name: "Haute tension", desc: "Un \xE9clair puissant, peu de rebonds.", cost: 70, parent: null, stats: { damage: 42, chain: 1, cooldown: 1.6, range: 3 } },
      { id: "statique", name: "Statique", desc: "Arcs tr\xE8s rapides et faibles, qui ralentissent.", cost: 70, parent: null, stats: { damage: 9, chain: 3, chainRange: 1.8, cooldown: 0.5, slow: 0.25, slowDuration: 0.8 } },
      { id: "reseau", name: "R\xE9seau", desc: "L\u2019\xE9clair traverse presque toute la vague.", cost: 110, parent: "arc-long", stats: { damage: 14, chain: 7, chainRange: 2.4, cooldown: 1 } },
      { id: "orage", name: "Orage", desc: "Les rebonds \xE9tourdissent bri\xE8vement.", cost: 110, parent: "arc-long", stats: { chain: 4, chainRange: 2.4, slow: 0.9, slowDuration: 0.6, cooldown: 1.7 } },
      { id: "foudroyeur", name: "Foudroyeur", desc: "Perce boucliers et armures.", cost: 110, parent: "haute-tension", stats: { damage: 85, cooldown: 2, pierceShield: true, range: 3.4 } },
      { id: "surtension", name: "Surtension", desc: "Cadence et d\xE9g\xE2ts \xE9lev\xE9s, mais la tour souffre.", cost: 110, parent: "haute-tension", stats: { damage: 60, chain: 2, cooldown: 1.2, maxHp: 70, repairCostMult: 1.6 } },
      { id: "champ-ionique", name: "Champ ionique", desc: "Une nu\xE9e de petits arcs ralentisseurs sur une grande zone.", cost: 110, parent: "statique", stats: { damage: 11, chain: 5, chainRange: 2.3, cooldown: 0.45, slow: 0.35, slowDuration: 1, range: 3.2 } },
      { id: "condensateur", name: "Condensateur", desc: "Charge longtemps, lib\xE8re un \xE9clair monstrueux.", cost: 110, parent: "statique", stats: { damage: 120, chain: 3, cooldown: 3.2, chainFalloff: 0.8, slow: 0, slowDuration: 0 } },
      // Niveau 4
      { id: "tempete-electrique", name: "Temp\xEAte \xE9lectrique", desc: "L\u2019\xE9clair frappe jusqu\u2019\xE0 11 ennemis.", cost: 160, parent: "reseau", stats: { chain: 11, chainRange: 2.8, cooldown: 0.9, chainFalloff: 0.85, maxHp: 80 } },
      { id: "faraday", name: "Cage de Faraday", desc: "Les rebonds figent presque les ennemis sur place.", cost: 150, parent: "orage", stats: { chain: 6, slow: 0.95, slowDuration: 0.9, cooldown: 1.8 } },
      { id: "jugement", name: "Jugement", desc: "Un \xE9clair colossal, perforant, \xE0 grande port\xE9e.", cost: 160, parent: "foudroyeur", stats: { damage: 170, chain: 2, chainFalloff: 0.7, cooldown: 2.4, range: 3.8, repairCostMult: 1.8 } }
    ]
  },
  laser: {
    id: "laser",
    name: "Rayon focalis\xE9",
    desc: "Plus il reste sur la m\xEAme cible, plus il frappe fort.",
    cost: 80,
    base: base({ maxHp: 100, damage: 4.5, range: 3.6, cooldown: 0.2, ramp: 0.1, rampMax: 10 }),
    nodes: [
      { id: "faisceau-lourd", name: "Faisceau lourd", desc: "Plus de d\xE9g\xE2ts et une mont\xE9e en puissance plus haute.", cost: 80, parent: null, stats: { damage: 6, ramp: 0.14, rampMax: 14, range: 4 } },
      { id: "prisme", name: "Prisme", desc: "Touche aussi les ennemis autour de la cible.", cost: 80, parent: null, stats: { damage: 3.5, splash: 1, ramp: 0.1, rampMax: 10 } },
      { id: "pulsar", name: "Pulsar", desc: "Impulsions puissantes et espac\xE9es.", cost: 80, parent: null, stats: { damage: 30, cooldown: 1, ramp: 0.25, rampMax: 6, range: 4.4 } },
      { id: "lance-solaire", name: "Lance solaire", desc: "Perce boucliers et armures.", cost: 120, parent: "faisceau-lourd", stats: { damage: 9, ramp: 0.16, rampMax: 16, pierceShield: true, range: 4.4, repairCostMult: 1.4 } },
      { id: "decoupeur", name: "D\xE9coupeur", desc: "Monte en puissance tr\xE8s vite : id\xE9al contre les blind\xE9s.", cost: 120, parent: "faisceau-lourd", stats: { damage: 5, ramp: 0.35, rampMax: 20 } },
      { id: "spectre", name: "Spectre", desc: "Zone plus large autour de la cible.", cost: 120, parent: "prisme", stats: { damage: 4.5, splash: 1.6, ramp: 0.12, rampMax: 12, range: 3.8 } },
      { id: "nova", name: "Nova", desc: "Pulsations lentes aux d\xE9g\xE2ts de zone puissants.", cost: 120, parent: "prisme", stats: { damage: 28, splash: 1.8, cooldown: 1, ramp: 0.15, rampMax: 6 } },
      { id: "quasar", name: "Quasar", desc: "Impulsions d\xE9vastatrices et perforantes.", cost: 130, parent: "pulsar", stats: { damage: 70, cooldown: 1.3, ramp: 0.3, rampMax: 8, pierceShield: true, repairCostMult: 1.6 } },
      // Niveau 4
      { id: "zenith", name: "Rayon z\xE9nith", desc: "Une puissance qui n\u2019en finit pas de monter.", cost: 170, parent: "lance-solaire", stats: { damage: 14, ramp: 0.2, rampMax: 20, range: 5, repairCostMult: 1.8 } },
      { id: "supernova", name: "Supernova", desc: "Zone \xE9norme, mont\xE9e en puissance de zone.", cost: 160, parent: "nova", stats: { damage: 38, splash: 2.6, cooldown: 1.1, ramp: 0.2, rampMax: 8, repairCostMult: 1.6 } }
    ]
  },
  relais: {
    id: "relais",
    name: "Relais tactique",
    desc: "Ne tire pas, mais renforce les tours voisines.",
    cost: 60,
    base: base({ maxHp: 110, damage: 0, range: 0, cooldown: 1, auraRadius: 2.2, auraDamage: 0.12 }),
    nodes: [
      { id: "amplificateur", name: "Amplificateur", desc: "D\xE9g\xE2ts des voisines +25 %.", cost: 70, parent: null, stats: { auraDamage: 0.25, auraRadius: 2.4 } },
      { id: "atelier", name: "Atelier", desc: "R\xE9pare gratuitement les voisines (4 PV/s).", cost: 70, parent: null, stats: { auraDamage: 0.06, auraHeal: 4, auraRadius: 2.4 } },
      { id: "collecteur", name: "Collecteur", desc: "Produit des ressources en continu, mais n\u2019aide plus au tir.", cost: 80, parent: null, stats: { auraDamage: 0, income: 0.4 } },
      { id: "overclock", name: "Overclock", desc: "D\xE9g\xE2ts +25 % et cadence +20 %, mais fragile.", cost: 110, parent: "amplificateur", stats: { auraDamage: 0.25, auraRate: 0.2, maxHp: 80 } },
      { id: "optique", name: "Optique", desc: "Port\xE9e des voisines +0,8, d\xE9g\xE2ts +20 %.", cost: 110, parent: "amplificateur", stats: { auraDamage: 0.2, auraReach: 0.8, auraRadius: 2.6 } },
      { id: "nano-forge", name: "Nano-forge", desc: "R\xE9pare 10 PV/s sur une zone plus large.", cost: 110, parent: "atelier", stats: { auraHeal: 10, auraRadius: 2.8 } },
      { id: "atelier-blinde", name: "Atelier blind\xE9", desc: "Tr\xE8s robuste, r\xE9pare 5 PV/s.", cost: 90, parent: "atelier", stats: { auraHeal: 5, maxHp: 420, repairCostMult: 0.5 } },
      { id: "raffinerie", name: "Raffinerie", desc: "Production plus que doubl\xE9e, mais fragile.", cost: 120, parent: "collecteur", stats: { income: 0.9, maxHp: 80 } },
      { id: "recycleur", name: "Recycleur", desc: "Production mod\xE9r\xE9e, et r\xE9pare un peu les voisines.", cost: 110, parent: "collecteur", stats: { income: 0.6, auraHeal: 3, auraRadius: 2.4 } },
      // Niveau 4
      { id: "singularite", name: "Singularit\xE9", desc: "L\u2019aura ultime : +40 % de d\xE9g\xE2ts, +30 % de cadence.", cost: 170, parent: "overclock", stats: { auraDamage: 0.4, auraRate: 0.3, auraRadius: 2.6, repairCostMult: 1.8 } },
      { id: "regeneration", name: "R\xE9g\xE9n\xE9ration totale", desc: "R\xE9pare 22 PV/s : le h\xE9ros respire enfin.", cost: 170, parent: "nano-forge", stats: { auraHeal: 22, auraRadius: 3, auraDamage: 0.1 } },
      { id: "complexe", name: "Complexe industriel", desc: "Production \xE9norme. \xC0 prot\xE9ger \xE0 tout prix.", cost: 170, parent: "raffinerie", stats: { income: 1.7, maxHp: 90, repairCostMult: 1.5 } }
    ]
  }
};
var SYNERGY_RANGE = 1.5;
var SYNERGIES = [
  { tower: "canon", neighbour: "givre", damageMult: 1.2, desc: "Plasma pr\xE8s d\u2019un Cryo : +20 % de d\xE9g\xE2ts." },
  { tower: "canon", neighbour: "canon", cooldownMult: 0.92, desc: "Deux Plasmas voisins : cadence +8 %." },
  { tower: "baliste", neighbour: "canon", rangeBonus: 0.5, desc: "Rails pr\xE8s d\u2019un Plasma : +0,5 de port\xE9e." },
  { tower: "givre", neighbour: "givre", rangeBonus: 0.4, desc: "Deux Cryos voisins : +0,4 de port\xE9e." },
  { tower: "foudre", neighbour: "givre", damageMult: 1.2, desc: "Tesla pr\xE8s d\u2019un Cryo : +20 % de d\xE9g\xE2ts (les ennemis givr\xE9s conduisent mieux)." },
  { tower: "foudre", neighbour: "foudre", rangeBonus: 0.3, desc: "Deux Tesla voisines : +0,3 de port\xE9e." },
  { tower: "laser", neighbour: "givre", cooldownMult: 0.9, desc: "Rayon pr\xE8s d\u2019un Cryo : cadence +10 % (cibles plus faciles \xE0 garder)." }
];

// shared/src/config/enemies.ts
var ENEMIES = {
  grunt: { id: "grunt", name: "Fantassin", desc: "Le soldat de base.", hp: 48, shield: 0, speed: 1.15, attack: 5, attackRange: 1.6, attackCooldown: 1.2, bounty: 5, cost: 2, fromWave: 1, leak: 1, size: 0.82, weight: 3 },
  runner: { id: "runner", name: "Coureur", desc: "Rapide et fragile.", hp: 22, shield: 0, speed: 2.2, attack: 3, attackRange: 1.3, attackCooldown: 1, bounty: 4, cost: 2, fromWave: 2, leak: 1, size: 0.86, weight: 2 },
  essaim: { id: "essaim", name: "Nu\xE9e", desc: "Minuscule, tr\xE8s nombreux, vite arriv\xE9 \xE0 la base.", hp: 13, shield: 0, speed: 1.9, attack: 2, attackRange: 1.1, attackCooldown: 0.8, bounty: 2, cost: 1, fromWave: 3, leak: 1, size: 0.5, weight: 4 },
  brute: { id: "brute", name: "Brute", desc: "Lente, r\xE9sistante, frappe fort.", hp: 160, shield: 0, speed: 0.7, attack: 18, attackRange: 1.8, attackCooldown: 1.5, bounty: 14, cost: 6, fromWave: 4, leak: 2, size: 1.05 },
  artilleur: { id: "artilleur", name: "Artilleur", desc: "Tire de loin sur les tours et s\u2019arr\xEAte pour le faire.", hp: 44, shield: 0, speed: 0.9, attack: 12, attackRange: 4.2, attackCooldown: 2.2, bounty: 13, cost: 6, fromWave: 5, leak: 1, size: 0.92, halts: true },
  sapeur: { id: "sapeur", name: "Sapeur", desc: "Court vers une tour et explose en zone.", hp: 34, shield: 0, speed: 1.55, attack: 34, attackRange: 1.3, attackCooldown: 0.5, bounty: 0, cost: 5, fromWave: 6, leak: 1, size: 0.8, blast: 1.2 },
  bouclier: { id: "bouclier", name: "Porte-bouclier", desc: "Un bouclier d\u2019\xE9nergie absorbe les d\xE9g\xE2ts avant ses PV.", hp: 60, shield: 80, speed: 0.95, attack: 6, attackRange: 1.6, attackCooldown: 1.2, bounty: 11, cost: 5, fromWave: 7, leak: 1, size: 0.95 },
  soigneur: { id: "soigneur", name: "Soigneur", desc: "Soigne les ennemis autour de lui : \xE0 abattre en priorit\xE9.", hp: 72, shield: 0, speed: 0.9, attack: 3, attackRange: 1.4, attackCooldown: 1.5, bounty: 14, cost: 6, fromWave: 8, leak: 1, size: 0.92, heals: { radius: 2.3, pct: 0.1, every: 2 } },
  blinde: { id: "blinde", name: "Blind\xE9", desc: "Armure lourde : les petits calibres rebondissent.", hp: 230, shield: 0, speed: 0.8, attack: 14, attackRange: 1.7, attackCooldown: 1.4, bounty: 16, cost: 9, fromWave: 10, leak: 2, size: 1.12, armor: 8 },
  golem: { id: "golem", name: "Golem", desc: "Un mur de roche qui avance. \xC9norm\xE9ment de PV.", hp: 420, shield: 0, speed: 0.5, attack: 30, attackRange: 2, attackCooldown: 2, bounty: 32, cost: 14, fromWave: 12, leak: 4, size: 1.45 },
  colosse: { id: "colosse", name: "Colosse", desc: "Boss : une masse de m\xE9tal.", hp: 1600, shield: 0, speed: 0.45, attack: 40, attackRange: 2.4, attackCooldown: 2, bounty: 150, cost: 0, fromWave: 0, leak: 10, boss: true, size: 1.9 },
  reine: { id: "reine", name: "Reine de l\u2019essaim", desc: "Boss : bouclier, et fait na\xEEtre des coureurs.", hp: 1100, shield: 300, speed: 0.6, attack: 15, attackRange: 2, attackCooldown: 1.5, bounty: 150, cost: 0, fromWave: 0, leak: 10, boss: true, spawns: "runner", spawnEvery: 2.5, size: 1.8 },
  sentinelle: { id: "sentinelle", name: "Sentinelle", desc: "Boss : armur\xE9e, canon \xE0 tr\xE8s longue port\xE9e, s\u2019arr\xEAte pour tirer.", hp: 1300, shield: 0, speed: 0.4, attack: 26, attackRange: 5.2, attackCooldown: 2.4, bounty: 150, cost: 0, fromWave: 0, leak: 10, boss: true, armor: 6, halts: true, size: 1.85 }
};
var BOSS_POOL = ["colosse", "reine", "sentinelle"];
var WAVE_CONFIG = {
  /** Un boss toutes les X vagues. */
  bossEvery: 10,
  /** Budget de la vague n = baseBudget * budgetGrowth^(n-1). */
  baseBudget: 28,
  budgetGrowth: 1.11,
  /** PV des ennemis : hpGrowth^(n-1), puis croissance plus douce après softCapWave (rendements décroissants). */
  hpGrowth: 1.07,
  hpSoftCapWave: 40,
  hpGrowthAfterCap: 1.035,
  /** L'attaque des ennemis monte plus lentement que leurs PV. */
  attackGrowth: 1.03,
  attackMaxMult: 6,
  /** La prime ne suit qu'en partie la difficulté : les ressources deviennent rares, pas infinies. */
  bountyGrowth: 1.04,
  bountyMaxMult: 5,
  /** Garde-fou de performance : au-delà, le budget restant est converti en PV supplémentaires. */
  maxEnemiesPerWave: 60,
  /** Durée visée d'apparition d'une vague, et intervalle minimal entre deux ennemis. */
  spawnWindow: 22,
  minSpawnInterval: 0.25,
  /** Un tireur ne s'arrête que ce temps (en secondes) : ensuite il avance en tirant, pour qu'une vague ne reste jamais bloquée. */
  haltMax: 8,
  /** Vague de boss : budget d'escorte réduit, PV du boss multipliés à chaque apparition. */
  bossEscortBudget: 0.5,
  bossHpGrowth: 1.9
};
function hpMultiplier(wave, cfg = WAVE_CONFIG) {
  const capped = Math.min(wave, cfg.hpSoftCapWave);
  const beyond = Math.max(0, wave - cfg.hpSoftCapWave);
  return Math.pow(cfg.hpGrowth, capped - 1) * Math.pow(cfg.hpGrowthAfterCap, beyond);
}
var attackMultiplier = (wave, cfg = WAVE_CONFIG) => Math.min(cfg.attackMaxMult, Math.pow(cfg.attackGrowth, wave - 1));
var bountyMultiplier = (wave, cfg = WAVE_CONFIG) => Math.min(cfg.bountyMaxMult, Math.pow(cfg.bountyGrowth, wave - 1));
var waveBudget = (wave, cfg = WAVE_CONFIG) => cfg.baseBudget * Math.pow(cfg.budgetGrowth, wave - 1);
var isBossWave = (wave, cfg = WAVE_CONFIG) => wave > 0 && wave % cfg.bossEvery === 0;

// shared/src/config/game.ts
var GAME_CONFIG = {
  tickRate: 20,
  /** Rythme de base : 1 seconde réelle = 1,2 seconde de jeu (avant le choix x1,5 / x2 / x3). */
  gameSpeed: 1.2,
  snapshotRate: 10,
  baseHp: 15,
  startScrap: 160,
  prepDuration: 30,
  interDuration: 20,
  // --- Économie : une seule ressource pour construire, améliorer et réparer ---
  /** Part de la prime versée directement au stock ; le reste tombe au sol et doit être ramassé. */
  directBountyShare: 0.4,
  pickupTtl: 14,
  pickupRadius: 0.8,
  /** Réparer 100 % d'une tour coûte cette part de tout ce qui a été investi dedans. */
  repairCostRatio: 0.8,
  /** Usure : réparer 100 % des PV retire cette part des PV max, définitivement. */
  wearPerFullRepair: 0.06,
  minMaxHpFactor: 0.5,
  /** Pendant une vague, la réparation rapide ne remonte pas au-delà de ce seuil. */
  quickRepairCap: 0.7,
  /** Vente d'urgence par le stratège : part de l'investissement, modulée par l'état de la tour. */
  sellRatio: 0.5,
  /** Recyclage par le héros : meilleur rendement, mais il doit se déplacer. */
  recycleRatio: 0.7,
  recycleTime: 3,
  /** Respécialisation : rembourse cette part des améliorations, et coûte un forfait. */
  respecRefund: 0.6,
  respecCost: 30,
  /** Déplacer une tour : part de l'investissement, puis tour inactive quelques secondes. */
  moveCostRatio: 0.25,
  moveDisable: 5,
  reloadTime: 2,
  /** Coût d'une recharge complète, en part du prix de base de la tour. */
  reloadCostRatio: 0.25,
  // --- Gisements et prospection ---
  depositStock: 60,
  depositRegenPerWave: 25,
  harvestTime: 2,
  harvestAmount: 15,
  prospectTime: 6,
  prospectCooldownWaves: 3,
  prospectSuccessChance: 0.7,
  /** Gain = prospectBase + prospectPerWave * vague. */
  prospectBase: 60,
  prospectPerWave: 8,
  prospectFailDamage: 45,
  // --- Synchronisation / reprise par l'IA ---
  reconnectGrace: 45
};
var HERO_CONFIG = {
  maxHp: 100,
  speed: 3.6,
  repairRate: 28,
  repairRange: 1.5,
  carryCap: 60,
  respawnTime: 8,
  /** Coût de la remise en route du héros : reviveBase + revivePerWave × vague, payé sur le stock commun. */
  reviveBase: 30,
  revivePerWave: 5,
  /** Régénération près de la base. */
  baseRegen: 12,
  baseRadius: 1.5
};
var HERO_NODES = [
  { id: "sprinteur", name: "Sprinteur", desc: "Vitesse +35 %.", cost: 80, parent: null, stats: { speed: 4.9 } },
  { id: "bras-long", name: "Bras long", desc: "R\xE9pare \xE0 distance (3,5 cases).", cost: 80, parent: null, stats: { repairRange: 3.5 } },
  { id: "econome", name: "\xC9conome", desc: "R\xE9parations -30 % moins ch\xE8res, mais plus lentes.", cost: 80, parent: null, stats: { repairCostMult: 0.7, repairRate: 20 } },
  { id: "porteur", name: "Porteur", desc: "Capacit\xE9 de port doubl\xE9e.", cost: 120, parent: "sprinteur", stats: { carryCap: 120 } },
  { id: "insaisissable", name: "Insaisissable", desc: "Encore plus rapide et plus r\xE9sistant.", cost: 130, parent: "sprinteur", stats: { speed: 5.8, maxHp: 140 } },
  { id: "soudeur", name: "Soudeur", desc: "R\xE9paration \xE0 distance deux fois plus rapide.", cost: 130, parent: "bras-long", stats: { repairRate: 56 } },
  { id: "telecommande", name: "T\xE9l\xE9commande", desc: "Port\xE9e de r\xE9paration de 6 cases.", cost: 120, parent: "bras-long", stats: { repairRange: 6 } },
  { id: "artisan", name: "Artisan", desc: "Ses r\xE9parations n\u2019usent presque plus les tours.", cost: 130, parent: "econome", stats: { wearMult: 0.3 } },
  { id: "ferrailleur", name: "Ferrailleur", desc: "R\xE9colte deux fois plus sur les gisements.", cost: 110, parent: "econome", stats: { harvestMult: 2 } }
];
var ABILITIES = {
  ralentir: { name: "Ralentir", desc: "Ralentit de 50 % une zone pendant 5 s.", cooldown: 25, radius: 2.5, duration: 5, power: 0.5, powerPerWave: 0 },
  foudre: { name: "Foudre", desc: "D\xE9g\xE2ts de zone imm\xE9diats.", cooldown: 20, radius: 1.5, duration: 0, power: 80, powerPerWave: 12 },
  surcharge: { name: "Surcharge", desc: "Une tour tire deux fois plus fort pendant 8 s, mais s\u2019ab\xEEme.", cooldown: 30, radius: 0, duration: 8, power: 2, powerPerWave: 0 }
};
var OVERCHARGE_SELF_DAMAGE = 0.04;
var REWARDS = {
  butin: { name: "Butin", desc: "Un gros apport de ressources." },
  "remise-a-neuf": { name: "Remise \xE0 neuf", desc: "Toutes les tours r\xE9par\xE9es gratuitement, sans usure." },
  renfort: { name: "Renfort", desc: "Efface l\u2019usure de toutes les tours." },
  tactique: { name: "Tactique", desc: "Comp\xE9tences recharg\xE9es 15 % plus vite, d\xE9finitivement." }
};
var REWARD_SCRAP_BASE = 150;
var REWARD_SCRAP_PER_WAVE = 10;

// shared/src/sim/types.ts
var HERO_COMMANDS = /* @__PURE__ */ new Set(["task", "heroUpgrade"]);
var roleOfCommand = (cmd) => HERO_COMMANDS.has(cmd.c) ? "hero" : "strategist";

// shared/src/protocol.ts
var CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var CODE_LENGTH = 5;
var SPEEDS = [1, 1.5, 2, 3];
var normalizeCode = (code) => code.trim().toUpperCase();
var isValidCode = (code) => code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));

// shared/src/sim/stats.ts
var dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function baseTowerStats(tower) {
  const def = TOWERS[tower.type];
  let stats = { ...def.base };
  for (const id of tower.path) {
    const node = def.nodes.find((n) => n.id === id);
    if (node) stats = { ...stats, ...node.stats };
  }
  return stats;
}
function effectiveTowerStats(tower, towers, map) {
  const stats = baseTowerStats(tower);
  const slot = map.slots[tower.slotId];
  if (slot?.high) stats.range *= 1 + MAP_CONFIG.highGroundRangeBonus;
  for (const syn of SYNERGIES) {
    if (syn.tower !== tower.type) continue;
    const active = towers.some(
      (o) => o.id !== tower.id && o.hp > 0 && o.type === syn.neighbour && dist(o.x, o.y, tower.x, tower.y) <= SYNERGY_RANGE
    );
    if (!active) continue;
    if (syn.damageMult) stats.damage *= syn.damageMult;
    if (syn.cooldownMult) stats.cooldown *= syn.cooldownMult;
    if (syn.rangeBonus) stats.range += syn.rangeBonus;
  }
  let aDamage = 0;
  let aRate = 0;
  let aReach = 0;
  for (const o of towers) {
    if (o.id === tower.id || o.hp <= 0 || o.type !== "relais") continue;
    const os = baseTowerStats(o);
    if (os.auraRadius <= 0 || dist(o.x, o.y, tower.x, tower.y) > os.auraRadius) continue;
    aDamage += os.auraDamage;
    aRate += os.auraRate;
    aReach += os.auraReach;
  }
  if (aDamage) stats.damage *= 1 + Math.min(AURA_CAP.damage, aDamage);
  if (aRate) stats.cooldown *= 1 - Math.min(AURA_CAP.rate, aRate);
  if (aReach) stats.range += Math.min(AURA_CAP.reach, aReach);
  return stats;
}
var AURA_CAP = { damage: 0.7, rate: 0.4, reach: 1.2 };
var towerMaxHp = (tower) => baseTowerStats(tower).maxHp * tower.maxHpFactor;
function heroStats(upgrades) {
  let stats = {
    maxHp: HERO_CONFIG.maxHp,
    speed: HERO_CONFIG.speed,
    repairRate: HERO_CONFIG.repairRate,
    repairRange: HERO_CONFIG.repairRange,
    carryCap: HERO_CONFIG.carryCap,
    repairCostMult: 1,
    wearMult: 1,
    harvestMult: 1
  };
  for (const id of upgrades) {
    const node = HERO_NODES.find((n) => n.id === id);
    if (node) stats = { ...stats, ...node.stats };
  }
  return stats;
}

// shared/src/sim/ai.ts
var POSTURES = {
  /** Fuit tôt, ne répare pas sous le feu, ne ramasse que ce qui est sûr. */
  prudente: { retreatHp: 0.6, avoidEnemies: 2.2, pickupDanger: 2.5, prospect: false },
  equilibree: { retreatHp: 0.35, avoidEnemies: 0, pickupDanger: 1.4, prospect: true },
  /** Répare sous le feu et ramasse tout : efficace, mais meurt plus souvent. */
  agressive: { retreatHp: 0.15, avoidEnemies: 0, pickupDanger: 0, prospect: true }
};
function decideHeroTask(game) {
  const s = game.state;
  const hero = s.hero;
  if (hero.respawnIn > 0) return null;
  const stats = heroStats(hero.upgrades);
  const posture = POSTURES[s.ai.posture];
  const inWave = s.phase === "wave";
  const enemyNear = (x, y, r) => r > 0 && s.enemies.some((e) => dist(e.x, e.y, x, y) <= r);
  const steps = (x, y) => {
    const n = game.stepsTo(x, y);
    return n < 0 ? 999 : n;
  };
  const repairCap = (t) => towerMaxHp(t) * (inWave ? GAME_CONFIG.quickRepairCap : 1);
  const needsRepair = (t) => t.hp < repairCap(t) - 0.5;
  const order = s.ai.order;
  if (order) {
    if (order.kind === "retreat") {
      game.aiSay("Je me replie \xE0 la base.");
      return { kind: "deliver" };
    }
    if (order.kind === "repair") {
      const t = s.towers.find((q) => q.id === order.targetId);
      if (t && needsRepair(t) && s.scrap > 0) {
        game.aiSay("Bien re\xE7u, je r\xE9pare cette tour.");
        return { kind: "repair", towerId: t.id };
      }
      s.ai.order = null;
    } else if (order.kind === "harvest") {
      const id = order.targetId;
      if (hero.carry >= stats.carryCap) return { kind: "deliver" };
      if (s.deposits[id] > 0) {
        game.aiSay("Bien re\xE7u, je vais r\xE9colter.");
        return { kind: "harvest", depositId: id };
      }
      s.ai.order = null;
    }
  }
  const hpFrac = hero.hp / stats.maxHp;
  const atBase = dist(hero.x, hero.y, game.map.base.x, game.map.base.y) <= HERO_CONFIG.baseRadius;
  if (hpFrac < posture.retreatHp && (enemyNear(hero.x, hero.y, 3.5) || atBase && inWave)) {
    game.aiSay("Je suis bless\xE9, je me replie.");
    return { kind: "deliver" };
  }
  const budgetLeft = s.ai.allowance - s.ai.spent;
  if (s.scrap >= 1) {
    const candidates = s.towers.filter((t) => {
      if (t.aiPriority === "sacrifice" || !needsRepair(t)) return false;
      const frac = t.hp / towerMaxHp(t);
      if (inWave && frac >= s.ai.repairThreshold) return false;
      if (inWave && t.aiPriority !== "high" && enemyNear(t.x, t.y, posture.avoidEnemies)) return false;
      return true;
    });
    if (candidates.length > 0) {
      if (budgetLeft < 1) {
        game.aiSay("Budget de r\xE9paration \xE9puis\xE9 : j\u2019attends ton accord (ordre \xAB R\xE9pare \xBB).");
      } else {
        const current = hero.task.kind === "repair" ? candidates.find((t) => t.id === hero.task.towerId) : void 0;
        const score = (t) => (t.aiPriority === "high" ? -10 : 0) + t.hp / towerMaxHp(t) + steps(t.x, t.y) * 0.03 - (t === current ? 0.25 : 0);
        const best = candidates.reduce((a, b) => score(b) < score(a) ? b : a);
        if (best.hp <= 0) game.aiSay("Une tour est tomb\xE9e, je la rel\xE8ve.");
        else if (s.ai.message.startsWith("Budget")) game.aiSay("");
        return { kind: "repair", towerId: best.id };
      }
    }
  }
  const empty = s.towers.find((t) => {
    const max = baseTowerStats(t).ammo;
    return max > 0 && t.hp > 0 && t.aiPriority !== "sacrifice" && t.ammo <= max * 0.2 && s.scrap >= TOWERS[t.type].cost * GAME_CONFIG.reloadCostRatio;
  });
  if (empty && !(inWave && enemyNear(empty.x, empty.y, posture.avoidEnemies))) return { kind: "reload", towerId: empty.id };
  if (hero.carry >= stats.carryCap * 0.7) return { kind: "deliver" };
  if (hero.carry < stats.carryCap) {
    let best = null;
    for (const p of s.pickups) {
      if (enemyNear(p.x, p.y, posture.pickupDanger)) continue;
      const d = steps(p.x, p.y);
      if (d / stats.speed > p.ttl) continue;
      if (!best || d < best.d) best = { id: p.id, d };
    }
    if (best) return { kind: "collect", pickupId: best.id };
  }
  if (!inWave) {
    const timeLeft = s.phaseTimer;
    const backHome = (x, y) => (steps(x, y) + Math.abs(x - game.map.base.x) + Math.abs(y - game.map.base.y)) / stats.speed;
    if (posture.prospect && hpFrac > 0.6) {
      const zone = game.map.prospectZones.find((z) => s.prospects[z.id] <= s.wave && backHome(z.x, z.y) + GAME_CONFIG.prospectTime + 2 < timeLeft);
      if (zone || hero.task.kind === "prospect") return zone ? { kind: "prospect", zoneId: zone.id } : null;
    }
    if (hero.carry < stats.carryCap) {
      let best = null;
      game.map.deposits.forEach((dep) => {
        if (s.deposits[dep.id] <= 0) return;
        if (backHome(dep.x, dep.y) + GAME_CONFIG.harvestTime + 1 > timeLeft) return;
        const d = steps(dep.x, dep.y);
        if (!best || d < best.d) best = { id: dep.id, d };
      });
      if (best) return { kind: "harvest", depositId: best.id };
    }
  }
  if (hero.carry > 0 || hpFrac < 1 || !atBase) return { kind: "deliver" };
  return { kind: "idle" };
}

// shared/src/sim/game.ts
var AI_PERIOD = 0.4;
var ORDER_TTL = 15;
var ORDER_COOLDOWN = 4;
function repairCost(tower, hp, heroCostMult = 1) {
  const stats = baseTowerStats(tower);
  return hp / stats.maxHp * tower.invested * GAME_CONFIG.repairCostRatio * stats.repairCostMult * heroCostMult;
}
var reviveCost = (wave) => HERO_CONFIG.reviveBase + HERO_CONFIG.revivePerWave * Math.max(1, wave);
function salvageValue(tower, ratio) {
  const frac = Math.max(0, tower.hp) / towerMaxHp(tower);
  return Math.floor(tower.invested * ratio * (0.4 + 0.6 * frac));
}
var Game = class {
  constructor(map) {
    this.map = map;
    this.rng = new Rng(map.seed ^ 2654435769);
    this.mud = new Set(map.mud);
    this.state = {
      tick: 0,
      time: 0,
      phase: "prep",
      phaseTimer: GAME_CONFIG.prepDuration,
      wave: 0,
      baseHp: GAME_CONFIG.baseHp,
      scrap: GAME_CONFIG.startScrap,
      towers: [],
      enemies: [],
      pickups: [],
      hero: { x: map.base.x, y: map.base.y, hp: HERO_CONFIG.maxHp, carry: 0, task: { kind: "idle" }, progress: 0, respawnIn: 0, waitingRevive: false, upgrades: [] },
      deposits: map.deposits.map(() => GAME_CONFIG.depositStock),
      prospects: map.prospectZones.map(() => 0),
      ai: { repairBudgetPct: 0.3, repairThreshold: 0.6, posture: "equilibree", allowance: 0, spent: 0, order: null, orderCooldown: 0, message: "" },
      heroController: "ai",
      abilities: { ralentir: 0, foudre: 0, surcharge: 0 },
      cooldownMult: 1,
      rewardChoices: null,
      toSpawn: 0,
      bossesKilled: 0
    };
    this.resetAllowance();
  }
  state;
  events = [];
  rng;
  nextId = 1;
  spawnQueue = [];
  waveClock = 0;
  aiClock = 0;
  mud;
  /** Champs de distance (BFS) vers une case, pour le déplacement du héros. La carte est fixe : cache permanent. */
  fields = /* @__PURE__ */ new Map();
  /** Renvoie les événements accumulés depuis le dernier appel, et vide la file. */
  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }
  emit(e) {
    if (this.events.length < 400) this.events.push(e);
  }
  aiSay(text) {
    if (this.state.ai.message === text) return;
    this.state.ai.message = text;
    if (text) this.emit({ t: "msg", from: "ia", text });
  }
  // ------------------------------------------------------------------ boucle
  step(dt) {
    const s = this.state;
    if (s.phase === "over") return;
    s.tick++;
    s.time += dt;
    for (const id of Object.keys(s.abilities)) s.abilities[id] = Math.max(0, s.abilities[id] - dt);
    s.ai.orderCooldown = Math.max(0, s.ai.orderCooldown - dt);
    if (s.ai.order && (s.ai.order.ttl -= dt) <= 0) s.ai.order = null;
    if (s.phase === "wave") {
      this.waveClock += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveClock) this.spawn(this.spawnQueue.shift());
      s.toSpawn = this.spawnQueue.length;
    } else {
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) this.startWave();
    }
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateHero(dt);
    for (const p of s.pickups) p.ttl -= dt;
    s.pickups = s.pickups.filter((p) => p.ttl > 0 && p.value > 0);
    if (s.heroController === "ai") {
      this.aiClock -= dt;
      if (this.aiClock <= 0) {
        this.aiClock = AI_PERIOD;
        const task = decideHeroTask(this);
        if (task) this.setHeroTask(task);
      }
    }
    if (s.baseHp <= 0) {
      s.baseHp = 0;
      s.phase = "over";
      this.emit({ t: "over", wave: s.wave });
    } else if (s.phase === "wave" && this.spawnQueue.length === 0 && s.enemies.length === 0) {
      this.endWave();
    }
  }
  resetAllowance() {
    const ai = this.state.ai;
    ai.allowance = Math.floor(this.state.scrap * ai.repairBudgetPct);
    ai.spent = 0;
  }
  // ------------------------------------------------------------------ vagues
  startWave() {
    const s = this.state;
    if (s.rewardChoices) this.applyReward(s.rewardChoices[0]);
    s.wave++;
    s.phase = "wave";
    s.phaseTimer = 0;
    this.waveClock = 0;
    this.spawnQueue = this.buildWave(s.wave);
    s.toSpawn = this.spawnQueue.length;
    this.resetAllowance();
    this.emit({ t: "wave", wave: s.wave, boss: isBossWave(s.wave) });
  }
  endWave() {
    const s = this.state;
    s.phase = "inter";
    s.phaseTimer = GAME_CONFIG.interDuration;
    s.deposits = s.deposits.map((d) => Math.min(GAME_CONFIG.depositStock, d + GAME_CONFIG.depositRegenPerWave));
    if (isBossWave(s.wave)) {
      const ids = this.rng.shuffle(Object.keys(REWARDS));
      s.rewardChoices = ids.slice(0, 3);
    }
    this.resetAllowance();
  }
  /** Compose la vague n : budget dépensé en ennemis disponibles, boss toutes les X vagues. */
  buildWave(wave) {
    const cfg = WAVE_CONFIG;
    const boss = isBossWave(wave);
    const total = waveBudget(wave) * (boss ? cfg.bossEscortBudget : 1);
    const pool = Object.values(ENEMIES).filter((e) => !e.boss && e.fromWave <= wave);
    const minCost = Math.min(...pool.map((e) => e.cost));
    const picks = [];
    let budget = total;
    while (budget >= minCost && picks.length < cfg.maxEnemiesPerWave) {
      const affordable = pool.filter((e) => e.cost <= budget);
      const def = this.pickWeighted(affordable);
      picks.push(def.id);
      budget -= def.cost;
    }
    const spent = total - budget;
    const overflow = spent > 0 ? total / spent : 1;
    const hpMult = hpMultiplier(wave) * overflow;
    const interval = Math.max(cfg.minSpawnInterval, cfg.spawnWindow / Math.max(1, picks.length));
    const queue = picks.map((type, i) => ({
      type,
      pathIdx: this.rng.int(0, this.map.paths.length - 1),
      at: 1 + i * interval,
      hpMult
    }));
    if (boss) {
      const n = wave / cfg.bossEvery;
      queue.push({
        type: BOSS_POOL[(n - 1) % BOSS_POOL.length],
        pathIdx: this.rng.int(0, this.map.paths.length - 1),
        at: 3,
        hpMult: Math.pow(cfg.bossHpGrowth, n - 1)
      });
      queue.sort((a, b) => a.at - b.at);
    }
    return queue;
  }
  /** Tirage pondéré : les ennemis communs reviennent plus souvent que les spécialistes. */
  pickWeighted(list) {
    let total = 0;
    for (const e of list) total += e.weight ?? 1;
    let r = this.rng.next() * total;
    for (const e of list) {
      r -= e.weight ?? 1;
      if (r <= 0) return e;
    }
    return list[list.length - 1];
  }
  spawn(entry, at) {
    const s = this.state;
    const def = ENEMIES[entry.type];
    const start = this.map.paths[entry.pathIdx][0];
    const maxHp = Math.round(def.hp * entry.hpMult);
    const e = {
      id: this.nextId++,
      type: entry.type,
      pathIdx: entry.pathIdx,
      d: at?.d ?? 0,
      x: start.x,
      y: start.y,
      hp: maxHp,
      maxHp,
      shield: Math.round(def.shield * entry.hpMult),
      attack: def.attack * attackMultiplier(Math.max(1, s.wave)),
      bounty: Math.round(def.bounty * bountyMultiplier(Math.max(1, s.wave))),
      slowFor: 0,
      slowFactor: 0,
      dotFor: 0,
      dotDps: 0,
      atkCd: def.attackCooldown * this.rng.next(),
      spawnCd: def.spawnEvery ?? def.heals?.every ?? 0,
      halted: 0
    };
    this.placeOnPath(e);
    s.enemies.push(e);
  }
  placeOnPath(e) {
    const path = this.map.paths[e.pathIdx];
    const i = Math.min(path.length - 2, Math.floor(e.d));
    const f = Math.min(1, e.d - i);
    e.x = path[i].x + (path[i + 1].x - path[i].x) * f;
    e.y = path[i].y + (path[i + 1].y - path[i].y) * f;
  }
  // ------------------------------------------------------------------ ennemis
  updateEnemies(dt) {
    const s = this.state;
    const hero = s.hero;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMIES[e.type];
      if (e.dotFor > 0) {
        e.dotFor -= dt;
        this.damageEnemy(e, e.dotDps * dt, true);
        if (e.hp <= 0) continue;
      }
      let target = def.halts && e.halted < WAVE_CONFIG.haltMax ? this.findTarget(e, def.attackRange) : void 0;
      if (target) e.halted += dt;
      if (!target) {
        let speed = def.speed;
        if (this.mud.has(Math.round(e.y) * this.map.width + Math.round(e.x))) speed *= MAP_CONFIG.mudSlowFactor;
        if (e.slowFor > 0) {
          e.slowFor -= dt;
          speed *= 1 - e.slowFactor;
        }
        e.d += speed * dt;
        const path = this.map.paths[e.pathIdx];
        if (e.d >= path.length - 1) {
          s.baseHp -= def.leak;
          e.hp = 0;
          e.bounty = 0;
          continue;
        }
        this.placeOnPath(e);
      } else if (e.slowFor > 0) e.slowFor -= dt;
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        if (target === void 0) target = this.findTarget(e, def.attackRange);
        if (target) {
          e.atkCd = def.attackCooldown;
          if (def.blast) this.explode(e, def.blast);
          else if ("hero" in target) this.damageHero(e.attack);
          else {
            target.tower.hp = Math.max(0, target.tower.hp - e.attack);
            if (target.tower.hp === 0) this.emit({ t: "hit", x: target.tower.x, y: target.tower.y, target: "tower" });
          }
        }
      }
      if (e.hp <= 0) continue;
      if (def.heals && (e.spawnCd -= dt) <= 0) {
        e.spawnCd = def.heals.every;
        let healed = false;
        for (const o of s.enemies) {
          if (o === e || o.hp <= 0 || o.hp >= o.maxHp || dist(o.x, o.y, e.x, e.y) > def.heals.radius) continue;
          o.hp = Math.min(o.maxHp, o.hp + Math.min(o.maxHp * def.heals.pct, e.maxHp * 0.25));
          healed = true;
        }
        if (healed) this.emit({ t: "heal", x: e.x, y: e.y, radius: def.heals.radius });
      }
      if (def.spawns && (e.spawnCd -= dt) <= 0) {
        e.spawnCd = def.spawnEvery;
        if (s.enemies.length < WAVE_CONFIG.maxEnemiesPerWave * 1.5)
          this.spawn({ type: def.spawns, pathIdx: e.pathIdx, at: 0, hpMult: hpMultiplier(s.wave) }, { d: e.d });
      }
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
  }
  /** Cible d'un ennemi : le héros s'il est à portée, sinon la tour active la plus proche. */
  findTarget(e, range) {
    const hero = this.state.hero;
    if (hero.respawnIn <= 0 && dist(e.x, e.y, hero.x, hero.y) <= range) return { hero: true };
    let best = null;
    let bestD = range;
    for (const t of this.state.towers) {
      if (t.hp <= 0) continue;
      const d = dist(e.x, e.y, t.x, t.y);
      if (d <= bestD) {
        bestD = d;
        best = t;
      }
    }
    return best ? { tower: best } : null;
  }
  /** Explosion d'un kamikaze : tout ce qui est dans le rayon prend des dégâts, et il disparaît sans rien rapporter. */
  explode(e, radius) {
    const s = this.state;
    for (const t of s.towers) {
      if (t.hp <= 0 || dist(e.x, e.y, t.x, t.y) > radius) continue;
      t.hp = Math.max(0, t.hp - e.attack);
      if (t.hp === 0) this.emit({ t: "hit", x: t.x, y: t.y, target: "tower" });
    }
    if (s.hero.respawnIn <= 0 && dist(e.x, e.y, s.hero.x, s.hero.y) <= radius) this.damageHero(e.attack);
    this.emit({ t: "blast", x: e.x, y: e.y, radius });
    e.hp = 0;
    e.bounty = 0;
  }
  damageEnemy(e, amount, pierce) {
    if (e.hp <= 0) return;
    const armor = ENEMIES[e.type].armor;
    if (armor && !pierce) amount = Math.max(amount * 0.25, amount - armor);
    if (e.shield > 0 && !pierce) {
      const absorbed = Math.min(e.shield, amount);
      e.shield -= absorbed;
      amount -= absorbed;
    }
    e.hp -= amount;
    if (e.hp > 0) return;
    const s = this.state;
    const boss = !!ENEMIES[e.type].boss;
    if (boss) s.bossesKilled++;
    const direct = Math.round(e.bounty * GAME_CONFIG.directBountyShare);
    s.scrap += direct;
    const dropped = e.bounty - direct;
    if (dropped > 0) s.pickups.push({ id: this.nextId++, x: e.x, y: e.y, value: dropped, ttl: GAME_CONFIG.pickupTtl });
    this.emit({ t: "death", x: e.x, y: e.y, boss });
  }
  // ------------------------------------------------------------------ tours
  updateTowers(dt) {
    const s = this.state;
    for (const t of s.towers) {
      if (t.hp <= 0) continue;
      if (t.disabledFor > 0) {
        t.disabledFor -= dt;
        continue;
      }
      const stats = effectiveTowerStats(t, s.towers, this.map);
      if (stats.income > 0) s.scrap += stats.income * dt;
      if (stats.auraHeal > 0) {
        for (const o of s.towers) {
          if (o === t || o.hp <= 0 || dist(o.x, o.y, t.x, t.y) > stats.auraRadius) continue;
          const max = towerMaxHp(o);
          if (o.hp < max) o.hp = Math.min(max, o.hp + stats.auraHeal * dt);
        }
      }
      if (stats.damage <= 0) continue;
      let power = 1;
      if (t.overchargeFor > 0) {
        t.overchargeFor -= dt;
        power = ABILITIES.surcharge.power;
        t.hp = Math.max(0, t.hp - towerMaxHp(t) * OVERCHARGE_SELF_DAMAGE * dt);
        if (t.hp === 0) continue;
      }
      t.cooldown -= dt;
      if (t.cooldown > 0 || t.ammo === 0) continue;
      let target = null;
      let score = -Infinity;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        const d = dist(t.x, t.y, e.x, e.y);
        if (d > stats.range || d < stats.minRange) continue;
        const v = t.targeting === "first" ? e.d - this.map.paths[e.pathIdx].length : t.targeting === "strong" ? e.hp + e.shield : t.targeting === "weak" ? -(e.hp + e.shield) : ENEMIES[e.type].speed * 1e3 + e.d;
        if (v > score) {
          score = v;
          target = e;
        }
      }
      if (!target) {
        t.cooldown = 0;
        continue;
      }
      t.cooldown = stats.cooldown;
      if (t.ammo > 0) t.ammo--;
      const tx = target.x;
      const ty = target.y;
      let damage = stats.damage * power;
      if (stats.ramp > 0) {
        if (t.focusId === target.id) t.focus = Math.min(stats.rampMax, t.focus + 1);
        else {
          t.focusId = target.id;
          t.focus = 0;
        }
        damage *= 1 + stats.ramp * t.focus;
      }
      if (stats.critChance > 0 && this.rng.chance(stats.critChance)) damage *= stats.critMult;
      const strike = (e, amount) => {
        if (stats.slow > 0 && (e.slowFor <= 0 || stats.slow >= e.slowFactor)) {
          e.slowFactor = stats.slow;
          e.slowFor = stats.slowDuration;
        }
        if (stats.dot > 0) {
          e.dotDps = Math.max(e.dotFor > 0 ? e.dotDps : 0, stats.dot * power);
          e.dotFor = stats.dotDuration;
        }
        this.damageEnemy(e, amount, stats.pierceShield);
      };
      const victims = stats.splash > 0 ? s.enemies.filter((e) => e.hp > 0 && dist(e.x, e.y, tx, ty) <= stats.splash) : [target];
      for (const e of victims) strike(e, damage);
      let chain;
      if (stats.chain > 0) {
        const struck = new Set(victims.map((v) => v.id));
        let from = target;
        let mult = 1;
        chain = [];
        for (let i = 0; i < stats.chain; i++) {
          let next = null;
          let bestD = stats.chainRange;
          for (const e of s.enemies) {
            if (e.hp <= 0 || struck.has(e.id)) continue;
            const d = dist(e.x, e.y, from.x, from.y);
            if (d <= bestD) {
              bestD = d;
              next = e;
            }
          }
          if (!next) break;
          mult *= stats.chainFalloff;
          struck.add(next.id);
          strike(next, damage * mult);
          chain.push(next.x, next.y);
          from = next;
        }
      }
      this.emit({ t: "shot", kind: t.type, fx: t.x, fy: t.y, tx, ty, splash: stats.splash, ...chain?.length ? { chain } : {} });
    }
  }
  removeTower(id) {
    const s = this.state;
    s.towers = s.towers.filter((t) => t.id !== id);
    const task = s.hero.task;
    if ("towerId" in task && task.towerId === id) this.setHeroTask({ kind: "idle" });
    if (s.ai.order?.targetId === id && s.ai.order.kind === "repair") s.ai.order = null;
  }
  // ------------------------------------------------------------------ héros
  setHeroTask(task) {
    const hero = this.state.hero;
    if (JSON.stringify(hero.task) === JSON.stringify(task)) return;
    hero.task = task;
    hero.progress = 0;
  }
  damageHero(amount) {
    const hero = this.state.hero;
    if (hero.respawnIn > 0) return;
    hero.hp -= amount;
    this.emit({ t: "hit", x: hero.x, y: hero.y, target: "hero" });
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.respawnIn = HERO_CONFIG.respawnTime;
      hero.carry = 0;
      hero.task = { kind: "idle" };
      hero.progress = 0;
      this.emit({ t: "msg", from: "jeu", text: `H\xE9ros \xE0 terre ! Remise en route dans ${HERO_CONFIG.respawnTime} s pour ${reviveCost(this.state.wave)} ressources.` });
    }
  }
  /** Champ de distance (en pas à 4 directions) vers une case, en évitant les rochers. */
  fieldTo(cx, cy) {
    const W = this.map.width;
    const H = this.map.height;
    const goal = cy * W + cx;
    let field = this.fields.get(goal);
    if (field) return field;
    field = new Int16Array(W * H).fill(-1);
    if (this.map.terrain[goal] !== "rock") {
      field[goal] = 0;
      const queue = [goal];
      for (let q = 0; q < queue.length; q++) {
        const i = queue[q];
        const x = i % W;
        const y = (i - x) / W;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
        for (const n of nb) {
          if (n < 0 || field[n] >= 0 || this.map.terrain[n] === "rock") continue;
          field[n] = field[i] + 1;
          queue.push(n);
        }
      }
    }
    this.fields.set(goal, field);
    return field;
  }
  /** Nombre de pas du héros jusqu'à une case (-1 si inaccessible). Utilisé par l'IA. */
  stepsTo(x, y) {
    const hero = this.state.hero;
    return this.fieldTo(Math.round(x), Math.round(y))[Math.round(hero.y) * this.map.width + Math.round(hero.x)];
  }
  isWalkable(x, y) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    return cx >= 0 && cy >= 0 && cx < this.map.width && cy < this.map.height && this.map.terrain[cy * this.map.width + cx] !== "rock";
  }
  /** Avance le héros vers (tx, ty). Renvoie true quand il est à moins de `stop` de la cible. */
  moveHero(tx, ty, stop, dt) {
    const hero = this.state.hero;
    if (dist(hero.x, hero.y, tx, ty) <= stop) return true;
    const W = this.map.width;
    const cx = Math.round(hero.x);
    const cy = Math.round(hero.y);
    const field = this.fieldTo(Math.round(tx), Math.round(ty));
    const here = field[cy * W + cx];
    let gx = tx;
    let gy = ty;
    if (here > 0) {
      const options = [
        { x: cx + 1, y: cy },
        { x: cx - 1, y: cy },
        { x: cx, y: cy + 1 },
        { x: cx, y: cy - 1 }
      ];
      for (const o of options) {
        if (o.x < 0 || o.y < 0 || o.x >= W || o.y >= this.map.height) continue;
        const v = field[o.y * W + o.x];
        if (v >= 0 && v < here) {
          const offAxis = o.x !== cx ? Math.abs(hero.y - cy) : Math.abs(hero.x - cx);
          if (offAxis > 0.05) {
            gx = o.x !== cx ? hero.x : cx;
            gy = o.x !== cx ? cy : hero.y;
          } else {
            gx = o.x;
            gy = o.y;
          }
          break;
        }
      }
    } else if (here < 0) {
      return false;
    }
    const d = dist(hero.x, hero.y, gx, gy);
    const stepLen = heroStats(hero.upgrades).speed * dt;
    if (d <= stepLen) {
      hero.x = gx;
      hero.y = gy;
    } else {
      hero.x += (gx - hero.x) / d * stepLen;
      hero.y += (gy - hero.y) / d * stepLen;
    }
    return dist(hero.x, hero.y, tx, ty) <= stop;
  }
  updateHero(dt) {
    const s = this.state;
    const hero = s.hero;
    const stats = heroStats(hero.upgrades);
    const base2 = this.map.base;
    if (hero.respawnIn > 0) {
      hero.respawnIn -= dt;
      if (hero.respawnIn <= 0) {
        const cost = reviveCost(s.wave);
        if (s.scrap < cost) {
          hero.respawnIn = 1e-3;
          if (!hero.waitingRevive) this.emit({ t: "msg", from: "jeu", text: `Il faut ${cost} ressources pour remettre le h\xE9ros en route.` });
          hero.waitingRevive = true;
          return;
        }
        s.scrap -= cost;
        hero.waitingRevive = false;
        hero.respawnIn = 0;
        hero.hp = stats.maxHp;
        hero.x = base2.x;
        hero.y = base2.y;
      }
      return;
    }
    if (dist(hero.x, hero.y, base2.x, base2.y) <= HERO_CONFIG.baseRadius) {
      s.scrap += hero.carry;
      hero.carry = 0;
      hero.hp = Math.min(stats.maxHp, hero.hp + HERO_CONFIG.baseRegen * dt);
    }
    for (const p of s.pickups) {
      if (hero.carry >= stats.carryCap) break;
      if (dist(hero.x, hero.y, p.x, p.y) > GAME_CONFIG.pickupRadius) continue;
      const take = Math.min(p.value, stats.carryCap - hero.carry);
      hero.carry += take;
      p.value -= take;
    }
    const task = hero.task;
    const done = () => this.setHeroTask({ kind: "idle" });
    switch (task.kind) {
      case "idle":
        break;
      case "move":
        if (this.moveHero(task.x, task.y, 0.05, dt) || !this.isWalkable(task.x, task.y)) done();
        break;
      case "deliver":
        if (this.moveHero(base2.x, base2.y, 0.5, dt) && hero.carry === 0 && hero.hp >= stats.maxHp) done();
        break;
      case "collect": {
        const p = s.pickups.find((q) => q.id === task.pickupId);
        if (!p || p.value <= 0 || hero.carry >= stats.carryCap) done();
        else this.moveHero(p.x, p.y, 0.1, dt);
        break;
      }
      case "harvest": {
        const d = this.map.deposits[task.depositId];
        if (!d || s.deposits[task.depositId] <= 0 || hero.carry >= stats.carryCap) return done();
        if (!this.moveHero(d.x, d.y, 0.3, dt)) break;
        hero.progress += dt / GAME_CONFIG.harvestTime;
        if (hero.progress >= 1) {
          hero.progress = 0;
          const taken = Math.min(GAME_CONFIG.harvestAmount, s.deposits[task.depositId]);
          s.deposits[task.depositId] -= taken;
          hero.carry = Math.min(stats.carryCap, hero.carry + Math.round(taken * stats.harvestMult));
        }
        break;
      }
      case "prospect": {
        const z = this.map.prospectZones[task.zoneId];
        if (!z || s.prospects[task.zoneId] > s.wave) return done();
        if (!this.moveHero(z.x, z.y, 0.3, dt)) break;
        hero.progress += dt / GAME_CONFIG.prospectTime;
        if (hero.progress >= 1) {
          s.prospects[task.zoneId] = s.wave + GAME_CONFIG.prospectCooldownWaves;
          if (this.rng.chance(GAME_CONFIG.prospectSuccessChance)) {
            const gain = GAME_CONFIG.prospectBase + GAME_CONFIG.prospectPerWave * s.wave;
            s.scrap += gain;
            this.emit({ t: "msg", from: "jeu", text: `Prospection r\xE9ussie : +${gain} ressources.` });
          } else {
            this.emit({ t: "msg", from: "jeu", text: "Prospection rat\xE9e : le h\xE9ros est bless\xE9." });
            this.damageHero(GAME_CONFIG.prospectFailDamage);
          }
          if (hero.respawnIn <= 0) done();
        }
        break;
      }
      case "repair":
      case "reload":
      case "recycle": {
        const t = s.towers.find((q) => q.id === task.towerId);
        if (!t) return done();
        if (!this.moveHero(t.x, t.y, stats.repairRange, dt)) {
          hero.progress = 0;
          break;
        }
        if (task.kind === "repair") this.repairStep(t, dt);
        else if (task.kind === "reload") {
          const max = baseTowerStats(t).ammo;
          if (max <= 0 || t.ammo >= max || t.hp <= 0) return done();
          hero.progress += dt / GAME_CONFIG.reloadTime;
          if (hero.progress >= 1) {
            const cost = Math.ceil(TOWERS[t.type].cost * GAME_CONFIG.reloadCostRatio * (1 - t.ammo / max));
            if (s.scrap >= cost) {
              s.scrap -= cost;
              t.ammo = max;
            } else this.emit({ t: "msg", from: "jeu", text: "Pas assez de ressources pour recharger." });
            done();
          }
        } else {
          hero.progress += dt / GAME_CONFIG.recycleTime;
          if (hero.progress >= 1) {
            s.scrap += salvageValue(t, GAME_CONFIG.recycleRatio);
            this.removeTower(t.id);
            done();
          }
        }
        break;
      }
    }
  }
  /** Une tranche de réparation : payée au fur et à mesure, avec usure définitive des PV max. */
  repairStep(t, dt) {
    const s = this.state;
    const hero = s.hero;
    const stats = heroStats(hero.upgrades);
    const fullMax = baseTowerStats(t).maxHp;
    const max = towerMaxHp(t);
    const cap = s.phase === "wave" ? max * GAME_CONFIG.quickRepairCap : max;
    if (t.hp >= cap - 0.01) return this.setHeroTask({ kind: "idle" });
    let amount = Math.min(stats.repairRate * dt, cap - t.hp);
    let cost = repairCost(t, amount, stats.repairCostMult);
    const ordered = s.ai.order?.kind === "repair" && s.ai.order.targetId === t.id;
    if (s.heroController === "ai" && !ordered && s.ai.spent + cost > s.ai.allowance) {
      this.aiSay("Budget de r\xE9paration \xE9puis\xE9 : j\u2019attends ton accord (ordre \xAB R\xE9pare \xBB).");
      return this.setHeroTask({ kind: "idle" });
    }
    if (cost > s.scrap) {
      amount *= s.scrap / cost;
      cost = s.scrap;
      if (amount < 0.01) {
        if (s.heroController === "ai") this.aiSay("Plus de ressources pour r\xE9parer.");
        return this.setHeroTask({ kind: "idle" });
      }
    }
    s.scrap -= cost;
    if (s.heroController === "ai" && !ordered) s.ai.spent += cost;
    t.maxHpFactor = Math.max(GAME_CONFIG.minMaxHpFactor, t.maxHpFactor - GAME_CONFIG.wearPerFullRepair * (amount / fullMax) * stats.wearMult);
    t.hp = Math.min(towerMaxHp(t), t.hp + amount);
    hero.progress = t.hp / towerMaxHp(t);
  }
  // ------------------------------------------------------------------ commandes
  /** Applique une commande. Renvoie null si elle est acceptée, sinon la raison du refus. */
  apply(role, cmd) {
    const s = this.state;
    if (s.phase === "over") return "La partie est termin\xE9e.";
    const tower = (id) => s.towers.find((t) => t.id === id);
    const pay = (cost) => {
      if (s.scrap < cost) return false;
      s.scrap -= cost;
      return true;
    };
    const poor = "Pas assez de ressources.";
    if (cmd.c === "task" || cmd.c === "heroUpgrade") {
      if (role !== "hero") return "Commande r\xE9serv\xE9e au h\xE9ros.";
      if (cmd.c === "heroUpgrade") {
        const last = s.hero.upgrades.length ? s.hero.upgrades[s.hero.upgrades.length - 1] : null;
        const node = HERO_NODES.find((n) => n.id === cmd.nodeId);
        if (!node || node.parent !== last) return "Am\xE9lioration indisponible.";
        if (!pay(node.cost)) return poor;
        s.hero.upgrades.push(node.id);
        return null;
      }
      if (s.hero.respawnIn > 0) return "Le h\xE9ros est \xE0 terre.";
      const task = cmd.task;
      switch (task.kind) {
        case "move":
          if (!this.isWalkable(task.x, task.y)) return "Destination inaccessible.";
          break;
        case "repair":
        case "reload":
        case "recycle":
          if (!tower(task.towerId)) return "Tour introuvable.";
          break;
        case "harvest":
          if (!this.map.deposits[task.depositId]) return "Gisement introuvable.";
          if (s.deposits[task.depositId] <= 0) return "Gisement \xE9puis\xE9.";
          break;
        case "prospect":
          if (!this.map.prospectZones[task.zoneId]) return "Zone introuvable.";
          if (s.prospects[task.zoneId] > s.wave) return "Zone d\xE9j\xE0 prospect\xE9e, reviens plus tard.";
          break;
        case "collect":
          if (!s.pickups.some((p) => p.id === task.pickupId)) return "Plus rien \xE0 ramasser.";
          break;
      }
      this.setHeroTask(task);
      return null;
    }
    if (role !== "strategist") return "Commande r\xE9serv\xE9e au strat\xE8ge.";
    switch (cmd.c) {
      case "build": {
        const slot = this.map.slots[cmd.slotId];
        const def = TOWERS[cmd.type];
        if (!slot || !def) return "Emplacement ou tour invalide.";
        if (s.towers.some((t) => t.slotId === slot.id)) return "Emplacement occup\xE9.";
        if (!pay(def.cost)) return poor;
        s.towers.push({
          id: this.nextId++,
          type: def.id,
          slotId: slot.id,
          x: slot.x,
          y: slot.y,
          hp: def.base.maxHp,
          maxHpFactor: 1,
          path: [],
          invested: def.cost,
          cooldown: 0,
          ammo: def.base.ammo || -1,
          targeting: "first",
          aiPriority: "normal",
          disabledFor: 0,
          overchargeFor: 0,
          focusId: 0,
          focus: 0
        });
        return null;
      }
      case "upgrade": {
        const t = tower(cmd.towerId);
        if (!t) return "Tour introuvable.";
        const last = t.path.length ? t.path[t.path.length - 1] : null;
        const node = TOWERS[t.type].nodes.find((n) => n.id === cmd.nodeId);
        if (!node || node.parent !== last) return "Am\xE9lioration indisponible : une autre voie a d\xE9j\xE0 \xE9t\xE9 choisie.";
        if (!pay(node.cost)) return poor;
        const frac = t.hp / towerMaxHp(t);
        t.path.push(node.id);
        t.invested += node.cost;
        t.hp = towerMaxHp(t) * frac;
        t.ammo = baseTowerStats(t).ammo || -1;
        return null;
      }
      case "respec": {
        const t = tower(cmd.towerId);
        if (!t || t.path.length === 0) return "Rien \xE0 resp\xE9cialiser.";
        const spent = t.path.reduce((sum, id) => sum + (TOWERS[t.type].nodes.find((n) => n.id === id)?.cost ?? 0), 0);
        const net = Math.floor(spent * GAME_CONFIG.respecRefund) - GAME_CONFIG.respecCost;
        if (s.scrap + net < 0) return poor;
        const frac = t.hp / towerMaxHp(t);
        s.scrap += net;
        t.path = [];
        t.invested -= spent;
        t.hp = towerMaxHp(t) * frac;
        t.ammo = baseTowerStats(t).ammo || -1;
        return null;
      }
      case "sell": {
        const t = tower(cmd.towerId);
        if (!t) return "Tour introuvable.";
        s.scrap += salvageValue(t, GAME_CONFIG.sellRatio);
        this.removeTower(t.id);
        return null;
      }
      case "moveTower": {
        const t = tower(cmd.towerId);
        const slot = this.map.slots[cmd.slotId];
        if (!t || !slot) return "Tour ou emplacement invalide.";
        if (s.towers.some((o) => o.slotId === slot.id)) return "Emplacement occup\xE9.";
        if (!pay(Math.ceil(t.invested * GAME_CONFIG.moveCostRatio))) return poor;
        t.slotId = slot.id;
        t.x = slot.x;
        t.y = slot.y;
        t.disabledFor = GAME_CONFIG.moveDisable;
        return null;
      }
      case "targeting": {
        const t = tower(cmd.towerId);
        if (!t) return "Tour introuvable.";
        if (!["first", "strong", "weak", "fast"].includes(cmd.mode)) return "Mode invalide.";
        t.targeting = cmd.mode;
        return null;
      }
      case "ability": {
        const def = ABILITIES[cmd.id];
        if (!def) return "Comp\xE9tence inconnue.";
        if (s.abilities[cmd.id] > 0) return "Comp\xE9tence en recharge.";
        if (cmd.id === "surcharge") {
          const t = cmd.towerId !== void 0 ? tower(cmd.towerId) : void 0;
          if (!t || t.hp <= 0) return "Choisis une tour active.";
          t.overchargeFor = def.duration;
          this.emit({ t: "ability", id: cmd.id, x: t.x, y: t.y, radius: 0.6 });
        } else {
          if (typeof cmd.x !== "number" || typeof cmd.y !== "number" || !Number.isFinite(cmd.x + cmd.y)) return "Choisis une zone.";
          const { x, y } = cmd;
          for (const e of s.enemies) {
            if (dist(e.x, e.y, x, y) > def.radius) continue;
            if (cmd.id === "ralentir") {
              e.slowFactor = Math.max(e.slowFor > 0 ? e.slowFactor : 0, def.power);
              e.slowFor = Math.max(e.slowFor, def.duration);
            } else this.damageEnemy(e, def.power + def.powerPerWave * s.wave, false);
          }
          this.emit({ t: "ability", id: cmd.id, x, y, radius: def.radius });
        }
        s.abilities[cmd.id] = def.cooldown * s.cooldownMult;
        return null;
      }
      case "aiSettings": {
        const n = cmd.settings ?? {};
        const clamp = (v, lo, hi, fallback) => typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
        const before = s.ai.repairBudgetPct;
        s.ai.repairBudgetPct = clamp(n.repairBudgetPct, 0, 1, s.ai.repairBudgetPct);
        s.ai.repairThreshold = clamp(n.repairThreshold, 0.1, 1, s.ai.repairThreshold);
        if (n.posture && ["prudente", "equilibree", "agressive"].includes(n.posture)) s.ai.posture = n.posture;
        if (s.ai.repairBudgetPct !== before) {
          s.ai.allowance = Math.floor((s.scrap + s.ai.spent) * s.ai.repairBudgetPct);
          s.ai.message = "";
        }
        return null;
      }
      case "aiPriority": {
        const t = tower(cmd.towerId);
        if (!t) return "Tour introuvable.";
        if (!["high", "normal", "sacrifice"].includes(cmd.priority)) return "Priorit\xE9 invalide.";
        t.aiPriority = cmd.priority;
        return null;
      }
      case "aiOrder": {
        if (s.ai.orderCooldown > 0) return "Ordre en recharge.";
        if (cmd.kind === "repair" && (cmd.targetId === void 0 || !tower(cmd.targetId))) return "Tour introuvable.";
        if (cmd.kind === "harvest" && (cmd.targetId === void 0 || !this.map.deposits[cmd.targetId])) return "Gisement introuvable.";
        if (!["repair", "retreat", "harvest"].includes(cmd.kind)) return "Ordre inconnu.";
        s.ai.order = { kind: cmd.kind, targetId: cmd.targetId, ttl: ORDER_TTL };
        s.ai.orderCooldown = ORDER_COOLDOWN;
        s.ai.message = "";
        this.aiClock = 0;
        return null;
      }
      case "reward": {
        if (!s.rewardChoices?.includes(cmd.id)) return "R\xE9compense indisponible.";
        this.applyReward(cmd.id);
        return null;
      }
      case "ready":
        if (s.phase === "wave") return "La vague est en cours.";
        s.phaseTimer = 0;
        return null;
    }
    return "Commande inconnue.";
  }
  applyReward(id) {
    const s = this.state;
    s.rewardChoices = null;
    if (id === "butin") s.scrap += REWARD_SCRAP_BASE + REWARD_SCRAP_PER_WAVE * s.wave;
    else if (id === "remise-a-neuf") for (const t of s.towers) t.hp = towerMaxHp(t);
    else if (id === "renfort")
      for (const t of s.towers) {
        const frac = t.hp / towerMaxHp(t);
        t.maxHpFactor = 1;
        t.hp = towerMaxHp(t) * frac;
      }
    else if (id === "tactique") s.cooldownMult *= 0.85;
    this.emit({ t: "msg", from: "jeu", text: `R\xE9compense : ${REWARDS[id].name}.` });
  }
};

// server/src/rooms.ts
var import_node_crypto = require("node:crypto");
var ROLES = ["strategist", "hero"];
var ROOM_IDLE_MS = 10 * 60 * 1e3;
var AWAY_AFTER_MS = 3e3;
var MAX_ROOMS = 200;
var MAX_CLIENTS_PER_ROOM = 8;
var Room = class {
  constructor(code, seed) {
    this.code = code;
    this.map = generateMap(seed);
  }
  clients = /* @__PURE__ */ new Map();
  map;
  game = null;
  /** Jeton du joueur qui tient chaque rôle (connecté ou en cours de reconnexion). */
  slots = { strategist: null, hero: null };
  tickCount = 0;
  /** Temps de jeu en attente : la simulation avance toujours par pas fixes, quelle que soit la vitesse. */
  pending = 0;
  /** Joueur qui a mis la partie en pause (null = elle tourne). */
  pausedBy = null;
  emptySince = 0;
  get connected() {
    return [...this.clients.values()].filter((c) => c.socket);
  }
  slotStatus(role) {
    const holder = this.slots[role] ? this.clients.get(this.slots[role]) : void 0;
    if (holder && (holder.socket || !holder.away)) return { status: "human", name: holder.name, speed: holder.speed };
    if (holder) return { status: "reconnecting", name: holder.name, speed: null };
    return { status: role === "hero" ? "ai" : "open", name: null, speed: null };
  }
  /** Vitesse appliquée : il faut l'accord de tous les joueurs humains, donc on prend la plus lente. */
  get speed() {
    const wanted = ROLES.map((r) => this.slotStatus(r).speed).filter((v) => v !== null);
    return wanted.length ? Math.min(...wanted) : 1;
  }
  lobby() {
    return {
      code: this.code,
      seed: this.map.requestedSeed,
      started: !!this.game,
      speed: this.speed,
      paused: this.pausedBy,
      slots: ROLES.map((role) => ({ role, ...this.slotStatus(role) })),
      spectators: this.connected.filter((c) => !c.role).length
    };
  }
  send(client, msg) {
    client.socket?.send(JSON.stringify(msg));
  }
  broadcastLobby() {
    const lobby = this.lobby();
    for (const c of this.connected) this.send(c, { m: "lobby", lobby, role: c.role });
  }
  /** Le héros est joué par l'IA dès que son slot n'est pas tenu par un humain connecté. */
  syncHeroController() {
    if (this.game) this.game.state.heroController = this.slotStatus("hero").status === "human" ? "human" : "ai";
  }
  /** Premier rôle libre pour un nouvel arrivant : stratège s'il manque, sinon héros à la place de l'IA. */
  freeRole() {
    return ROLES.find((r) => this.slots[r] === null) ?? null;
  }
  join(socket, name, token) {
    let client = token ? this.clients.get(token) : void 0;
    if (client) {
      client.socket = socket;
      client.away = false;
      client.name = name || client.name;
      if (client.role && this.slots[client.role] !== client.token) client.role = null;
    } else {
      if (this.clients.size >= MAX_CLIENTS_PER_ROOM) return "Cette partie est compl\xE8te.";
      client = { token: (0, import_node_crypto.randomBytes)(16).toString("hex"), name, socket, role: null, disconnectedAt: 0, away: false, speed: 1 };
      this.clients.set(client.token, client);
    }
    if (!client.role) {
      const role = this.freeRole();
      if (role) this.assign(client, role);
    }
    this.syncHeroController();
    this.send(client, { m: "joined", token: client.token, role: client.role, lobby: this.lobby() });
    if (this.game) {
      this.send(client, { m: "started", map: this.map });
      this.send(client, { m: "state", state: this.game.state, events: [] });
    }
    this.broadcastLobby();
    return client;
  }
  assign(client, role) {
    if (client.role) this.slots[client.role] = null;
    this.slots[role] = client.token;
    client.role = role;
  }
  handle(client, msg) {
    switch (msg.m) {
      case "take": {
        if (!ROLES.includes(msg.role)) return;
        const status = this.slotStatus(msg.role).status;
        if (status === "human") return this.send(client, { m: "error", text: "Ce r\xF4le est d\xE9j\xE0 tenu par un joueur." });
        if (status === "reconnecting") return this.send(client, { m: "error", text: "Ce joueur est en cours de reconnexion, r\xE9essaie dans un instant." });
        this.assign(client, msg.role);
        this.syncHeroController();
        if (this.game && msg.role === "hero") this.game.emit({ t: "msg", from: "jeu", text: `${client.name} reprend le h\xE9ros \xE0 la place de l\u2019IA.` });
        this.broadcastLobby();
        return;
      }
      case "release": {
        if (!client.role) return;
        const role = client.role;
        this.slots[role] = null;
        client.role = null;
        this.syncHeroController();
        if (this.game && role === "hero") this.game.emit({ t: "msg", from: "jeu", text: "L\u2019IA reprend le h\xE9ros." });
        this.broadcastLobby();
        return;
      }
      case "speed": {
        if (!client.role || !SPEEDS.includes(msg.speed)) return;
        client.speed = msg.speed;
        if (this.game && this.speed < msg.speed)
          this.game.emit({ t: "msg", from: "jeu", text: `${client.name} propose la vitesse x${msg.speed}. Elle s\u2019appliquera quand l\u2019autre joueur l\u2019acceptera.` });
        this.broadcastLobby();
        return;
      }
      case "pause": {
        if (!this.game || !client.role || this.game.state.phase === "over") return;
        const on = !!msg.on;
        if (on === (this.pausedBy !== null)) return;
        this.pausedBy = on ? client.name : null;
        this.game.emit({ t: "msg", from: "jeu", text: on ? `${client.name} a mis la partie en pause.` : `${client.name} relance la partie.` });
        this.broadcastLobby();
        this.sendState();
        return;
      }
      case "start": {
        if (this.game) return;
        if (client.role !== "strategist") return this.send(client, { m: "error", text: "Seul le strat\xE8ge peut lancer la partie." });
        this.begin();
        return;
      }
      case "restart": {
        if (!this.game || !client.role) return;
        const over = this.game.state.phase === "over";
        if (!over && client.role !== "strategist") return this.send(client, { m: "error", text: "Seul le strat\xE8ge peut relancer une partie en cours." });
        this.map = generateMap(msg.sameMap ? this.map.requestedSeed : (0, import_node_crypto.randomInt)(2 ** 32));
        this.begin();
        return;
      }
      case "leave":
        return this.leave(client);
      case "cmd": {
        if (!this.game) return;
        const cmd = msg.cmd;
        if (!cmd || typeof cmd !== "object" || typeof cmd.c !== "string") return;
        if (!client.role || roleOfCommand(cmd) !== client.role) return this.send(client, { m: "error", text: "Cette action n\u2019est pas dans ton r\xF4le." });
        let error;
        try {
          error = this.game.apply(client.role, cmd);
        } catch {
          error = "Commande invalide.";
        }
        if (error) this.send(client, { m: "error", text: error });
        return;
      }
      case "ping":
        return this.send(client, { m: "pong", t: msg.t });
    }
  }
  /** Démarre (ou redémarre) la partie avec la carte du salon, pour tous les joueurs connectés. */
  begin() {
    this.game = new Game(this.map);
    this.pausedBy = null;
    this.pending = 0;
    this.syncHeroController();
    for (const c of this.connected) this.send(c, { m: "started", map: this.map });
    this.broadcastLobby();
  }
  /** Départ volontaire : le rôle est libéré immédiatement, sans délai de reconnexion. */
  leave(client) {
    const role = client.role;
    if (role) {
      this.slots[role] = null;
      client.role = null;
    }
    client.socket = null;
    this.clients.delete(client.token);
    this.syncHeroController();
    if (this.game && role === "hero") this.game.emit({ t: "msg", from: "jeu", text: `${client.name} a quitt\xE9 la partie : l\u2019IA reprend le h\xE9ros.` });
    this.broadcastLobby();
  }
  disconnect(client, now) {
    client.socket = null;
    client.disconnectedAt = now;
  }
  /** Appelé à chaque tick du serveur. */
  tick(now, dt) {
    let changed = false;
    for (const c of this.clients.values()) {
      if (c.socket) continue;
      if (!c.away && now - c.disconnectedAt >= AWAY_AFTER_MS) {
        c.away = true;
        changed = true;
        if (this.game && c.role === "hero") this.game.emit({ t: "msg", from: "jeu", text: `${c.name} est d\xE9connect\xE9 : l\u2019IA prend le relais.` });
      }
      if (now - c.disconnectedAt < GAME_CONFIG.reconnectGrace * 1e3) continue;
      if (c.role) {
        this.slots[c.role] = null;
        c.role = null;
        changed = true;
      }
      if (now - c.disconnectedAt > ROOM_IDLE_MS) this.clients.delete(c.token);
    }
    if (changed) {
      this.syncHeroController();
      this.broadcastLobby();
    }
    const connected = this.connected;
    if (connected.length === 0) {
      if (!this.emptySince) this.emptySince = now;
      return;
    }
    this.emptySince = 0;
    if (!this.game) return;
    if (!this.pausedBy) {
      this.pending += dt * this.speed * GAME_CONFIG.gameSpeed;
      for (let i = 0; this.pending >= dt - 1e-9 && i < 8; i++) {
        this.game.step(dt);
        this.pending -= dt;
      }
    }
    this.tickCount++;
    const every = Math.max(1, Math.round(GAME_CONFIG.tickRate / GAME_CONFIG.snapshotRate));
    if (this.tickCount % every === 0) this.sendState();
  }
  sendState() {
    if (!this.game) return;
    const payload = JSON.stringify({ m: "state", state: this.game.state, events: this.game.drainEvents() });
    for (const c of this.connected) c.socket.send(payload);
  }
  isExpired(now) {
    return this.emptySince > 0 && now - this.emptySince > ROOM_IDLE_MS;
  }
};
var RoomManager = class {
  rooms = /* @__PURE__ */ new Map();
  newCode() {
    for (; ; ) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[(0, import_node_crypto.randomInt)(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }
  /** Seed fournie par le joueur (nombre ou texte libre), sinon tirée au hasard. */
  create(seedInput) {
    if (this.rooms.size >= MAX_ROOMS) return "Le serveur est plein, r\xE9essaie plus tard.";
    const text = (seedInput ?? "").trim().slice(0, 40);
    const seed = text === "" ? (0, import_node_crypto.randomInt)(2 ** 32) : /^\d{1,10}$/.test(text) ? Number(text) >>> 0 : hashSeed(text);
    const room = new Room(this.newCode(), seed);
    this.rooms.set(room.code, room);
    return room;
  }
  tick(now, dt) {
    for (const room of this.rooms.values()) {
      room.tick(now, dt);
      if (room.isExpired(now)) this.rooms.delete(room.code);
    }
  }
};

// server/src/ws.ts
var WS_MAX_PAYLOAD = 16 * 1024;
function attachGame(wss) {
  const manager2 = new RoomManager();
  wss.on("connection", (ws) => {
    let room = null;
    let client = null;
    const socket = { send: (data) => ws.readyState === import_websocket.default.OPEN && ws.send(data) };
    const reply = (msg) => socket.send(JSON.stringify(msg));
    let budget = 60;
    const refill = setInterval(() => budget = 60, 1e3);
    ws.on("message", (raw) => {
      if (--budget < 0) return;
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object" || typeof msg.m !== "string") return;
      if (msg.m === "create" || msg.m === "join") {
        if (client) return;
        const name = String(msg.name ?? "").trim().slice(0, 20) || "Joueur";
        let target;
        if (msg.m === "create") target = manager2.create(typeof msg.seed === "string" ? msg.seed : void 0);
        else {
          const code = normalizeCode(String(msg.code ?? ""));
          target = isValidCode(code) ? manager2.rooms.get(code) : void 0;
          if (!target) return reply({ m: "error", text: "Aucune partie avec ce code." });
        }
        if (typeof target === "string") return reply({ m: "error", text: target });
        const joined = target.join(socket, name, msg.m === "join" && typeof msg.token === "string" ? msg.token : void 0);
        if (typeof joined === "string") return reply({ m: "error", text: joined });
        room = target;
        client = joined;
        return;
      }
      if (msg.m === "ping") return reply({ m: "pong", t: msg.t });
      if (msg.m === "leave") {
        if (room && client) room.leave(client);
        room = null;
        client = null;
        return;
      }
      if (room && client) room.handle(client, msg);
    });
    ws.on("close", () => {
      clearInterval(refill);
      if (room && client && client.socket === socket) room.disconnect(client, Date.now());
    });
    ws.on("error", () => ws.close());
  });
  const dt = 1 / GAME_CONFIG.tickRate;
  setInterval(() => manager2.tick(Date.now(), dt), 1e3 / GAME_CONFIG.tickRate);
  return manager2;
}

// server/src/vercel.ts
var server = (0, import_node_http.createServer)((_req, res) => {
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify({ ok: true, rooms: manager.rooms.size }));
});
var manager = attachGame(new import_websocket_server.default({ server, maxPayload: WS_MAX_PAYLOAD }));
var vercel_default = server;
