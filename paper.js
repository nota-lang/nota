var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __reExport = (target, module, desc) => {
  if (module && typeof module === "object" || typeof module === "function") {
    for (let key of __getOwnPropNames(module))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module[key], enumerable: !(desc = __getOwnPropDesc(module, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module) => {
  return __reExport(__markAsModule(__defProp(module != null ? __create(__getProtoOf(module)) : {}, "default", module && module.__esModule && "default" in module ? { get: () => module.default, enumerable: true } : { value: module, enumerable: true })), module);
};

// node_modules/axios/lib/helpers/bind.js
var require_bind = __commonJS({
  "node_modules/axios/lib/helpers/bind.js"(exports, module) {
    "use strict";
    module.exports = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };
  }
});

// node_modules/axios/lib/utils.js
var require_utils = __commonJS({
  "node_modules/axios/lib/utils.js"(exports, module) {
    "use strict";
    var bind = require_bind();
    var toString = Object.prototype.toString;
    function isArray(val) {
      return toString.call(val) === "[object Array]";
    }
    function isUndefined(val) {
      return typeof val === "undefined";
    }
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor) && typeof val.constructor.isBuffer === "function" && val.constructor.isBuffer(val);
    }
    function isArrayBuffer(val) {
      return toString.call(val) === "[object ArrayBuffer]";
    }
    function isFormData(val) {
      return typeof FormData !== "undefined" && val instanceof FormData;
    }
    function isArrayBufferView(val) {
      var result;
      if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
        result = ArrayBuffer.isView(val);
      } else {
        result = val && val.buffer && val.buffer instanceof ArrayBuffer;
      }
      return result;
    }
    function isString(val) {
      return typeof val === "string";
    }
    function isNumber(val) {
      return typeof val === "number";
    }
    function isObject(val) {
      return val !== null && typeof val === "object";
    }
    function isPlainObject(val) {
      if (toString.call(val) !== "[object Object]") {
        return false;
      }
      var prototype = Object.getPrototypeOf(val);
      return prototype === null || prototype === Object.prototype;
    }
    function isDate(val) {
      return toString.call(val) === "[object Date]";
    }
    function isFile(val) {
      return toString.call(val) === "[object File]";
    }
    function isBlob(val) {
      return toString.call(val) === "[object Blob]";
    }
    function isFunction(val) {
      return toString.call(val) === "[object Function]";
    }
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }
    function isURLSearchParams(val) {
      return typeof URLSearchParams !== "undefined" && val instanceof URLSearchParams;
    }
    function trim(str) {
      return str.replace(/^\s*/, "").replace(/\s*$/, "");
    }
    function isStandardBrowserEnv() {
      if (typeof navigator !== "undefined" && (navigator.product === "ReactNative" || navigator.product === "NativeScript" || navigator.product === "NS")) {
        return false;
      }
      return typeof window !== "undefined" && typeof document !== "undefined";
    }
    function forEach(obj, fn) {
      if (obj === null || typeof obj === "undefined") {
        return;
      }
      if (typeof obj !== "object") {
        obj = [obj];
      }
      if (isArray(obj)) {
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }
    function merge() {
      var result = {};
      function assignValue(val, key) {
        if (isPlainObject(result[key]) && isPlainObject(val)) {
          result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
          result[key] = merge({}, val);
        } else if (isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      }
      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === "function") {
          a[key] = bind(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }
    function stripBOM(content) {
      if (content.charCodeAt(0) === 65279) {
        content = content.slice(1);
      }
      return content;
    }
    module.exports = {
      isArray,
      isArrayBuffer,
      isBuffer,
      isFormData,
      isArrayBufferView,
      isString,
      isNumber,
      isObject,
      isPlainObject,
      isUndefined,
      isDate,
      isFile,
      isBlob,
      isFunction,
      isStream,
      isURLSearchParams,
      isStandardBrowserEnv,
      forEach,
      merge,
      extend,
      trim,
      stripBOM
    };
  }
});

// node_modules/axios/lib/helpers/buildURL.js
var require_buildURL = __commonJS({
  "node_modules/axios/lib/helpers/buildURL.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    function encode(val) {
      return encodeURIComponent(val).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]");
    }
    module.exports = function buildURL(url, params, paramsSerializer) {
      if (!params) {
        return url;
      }
      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];
        utils.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === "undefined") {
            return;
          }
          if (utils.isArray(val)) {
            key = key + "[]";
          } else {
            val = [val];
          }
          utils.forEach(val, function parseValue(v) {
            if (utils.isDate(v)) {
              v = v.toISOString();
            } else if (utils.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + "=" + encode(v));
          });
        });
        serializedParams = parts.join("&");
      }
      if (serializedParams) {
        var hashmarkIndex = url.indexOf("#");
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }
        url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
      }
      return url;
    };
  }
});

// node_modules/axios/lib/core/InterceptorManager.js
var require_InterceptorManager = __commonJS({
  "node_modules/axios/lib/core/InterceptorManager.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    function InterceptorManager() {
      this.handlers = [];
    }
    InterceptorManager.prototype.use = function use(fulfilled, rejected) {
      this.handlers.push({
        fulfilled,
        rejected
      });
      return this.handlers.length - 1;
    };
    InterceptorManager.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };
    InterceptorManager.prototype.forEach = function forEach(fn) {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };
    module.exports = InterceptorManager;
  }
});

// node_modules/axios/lib/core/transformData.js
var require_transformData = __commonJS({
  "node_modules/axios/lib/core/transformData.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    module.exports = function transformData(data, headers, fns) {
      utils.forEach(fns, function transform(fn) {
        data = fn(data, headers);
      });
      return data;
    };
  }
});

// node_modules/axios/lib/cancel/isCancel.js
var require_isCancel = __commonJS({
  "node_modules/axios/lib/cancel/isCancel.js"(exports, module) {
    "use strict";
    module.exports = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };
  }
});

// node_modules/axios/lib/helpers/normalizeHeaderName.js
var require_normalizeHeaderName = __commonJS({
  "node_modules/axios/lib/helpers/normalizeHeaderName.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    module.exports = function normalizeHeaderName(headers, normalizedName) {
      utils.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };
  }
});

// node_modules/axios/lib/core/enhanceError.js
var require_enhanceError = __commonJS({
  "node_modules/axios/lib/core/enhanceError.js"(exports, module) {
    "use strict";
    module.exports = function enhanceError(error, config, code, request, response) {
      error.config = config;
      if (code) {
        error.code = code;
      }
      error.request = request;
      error.response = response;
      error.isAxiosError = true;
      error.toJSON = function toJSON() {
        return {
          message: this.message,
          name: this.name,
          description: this.description,
          number: this.number,
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          config: this.config,
          code: this.code
        };
      };
      return error;
    };
  }
});

// node_modules/axios/lib/core/createError.js
var require_createError = __commonJS({
  "node_modules/axios/lib/core/createError.js"(exports, module) {
    "use strict";
    var enhanceError = require_enhanceError();
    module.exports = function createError(message, config, code, request, response) {
      var error = new Error(message);
      return enhanceError(error, config, code, request, response);
    };
  }
});

// node_modules/axios/lib/core/settle.js
var require_settle = __commonJS({
  "node_modules/axios/lib/core/settle.js"(exports, module) {
    "use strict";
    var createError = require_createError();
    module.exports = function settle(resolve, reject, response) {
      var validateStatus = response.config.validateStatus;
      if (!response.status || !validateStatus || validateStatus(response.status)) {
        resolve(response);
      } else {
        reject(createError("Request failed with status code " + response.status, response.config, null, response.request, response));
      }
    };
  }
});

// node_modules/axios/lib/helpers/cookies.js
var require_cookies = __commonJS({
  "node_modules/axios/lib/helpers/cookies.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    module.exports = utils.isStandardBrowserEnv() ? function standardBrowserEnv() {
      return {
        write: function write(name, value, expires, path, domain, secure) {
          var cookie = [];
          cookie.push(name + "=" + encodeURIComponent(value));
          if (utils.isNumber(expires)) {
            cookie.push("expires=" + new Date(expires).toGMTString());
          }
          if (utils.isString(path)) {
            cookie.push("path=" + path);
          }
          if (utils.isString(domain)) {
            cookie.push("domain=" + domain);
          }
          if (secure === true) {
            cookie.push("secure");
          }
          document.cookie = cookie.join("; ");
        },
        read: function read(name) {
          var match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
          return match ? decodeURIComponent(match[3]) : null;
        },
        remove: function remove(name) {
          this.write(name, "", Date.now() - 864e5);
        }
      };
    }() : function nonStandardBrowserEnv() {
      return {
        write: function write() {
        },
        read: function read() {
          return null;
        },
        remove: function remove() {
        }
      };
    }();
  }
});

// node_modules/axios/lib/helpers/isAbsoluteURL.js
var require_isAbsoluteURL = __commonJS({
  "node_modules/axios/lib/helpers/isAbsoluteURL.js"(exports, module) {
    "use strict";
    module.exports = function isAbsoluteURL(url) {
      return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
    };
  }
});

// node_modules/axios/lib/helpers/combineURLs.js
var require_combineURLs = __commonJS({
  "node_modules/axios/lib/helpers/combineURLs.js"(exports, module) {
    "use strict";
    module.exports = function combineURLs(baseURL, relativeURL) {
      return relativeURL ? baseURL.replace(/\/+$/, "") + "/" + relativeURL.replace(/^\/+/, "") : baseURL;
    };
  }
});

// node_modules/axios/lib/core/buildFullPath.js
var require_buildFullPath = __commonJS({
  "node_modules/axios/lib/core/buildFullPath.js"(exports, module) {
    "use strict";
    var isAbsoluteURL = require_isAbsoluteURL();
    var combineURLs = require_combineURLs();
    module.exports = function buildFullPath(baseURL, requestedURL) {
      if (baseURL && !isAbsoluteURL(requestedURL)) {
        return combineURLs(baseURL, requestedURL);
      }
      return requestedURL;
    };
  }
});

// node_modules/axios/lib/helpers/parseHeaders.js
var require_parseHeaders = __commonJS({
  "node_modules/axios/lib/helpers/parseHeaders.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var ignoreDuplicateOf = [
      "age",
      "authorization",
      "content-length",
      "content-type",
      "etag",
      "expires",
      "from",
      "host",
      "if-modified-since",
      "if-unmodified-since",
      "last-modified",
      "location",
      "max-forwards",
      "proxy-authorization",
      "referer",
      "retry-after",
      "user-agent"
    ];
    module.exports = function parseHeaders(headers) {
      var parsed = {};
      var key;
      var val;
      var i;
      if (!headers) {
        return parsed;
      }
      utils.forEach(headers.split("\n"), function parser2(line) {
        i = line.indexOf(":");
        key = utils.trim(line.substr(0, i)).toLowerCase();
        val = utils.trim(line.substr(i + 1));
        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            return;
          }
          if (key === "set-cookie") {
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ", " + val : val;
          }
        }
      });
      return parsed;
    };
  }
});

// node_modules/axios/lib/helpers/isURLSameOrigin.js
var require_isURLSameOrigin = __commonJS({
  "node_modules/axios/lib/helpers/isURLSameOrigin.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    module.exports = utils.isStandardBrowserEnv() ? function standardBrowserEnv() {
      var msie = /(msie|trident)/i.test(navigator.userAgent);
      var urlParsingNode = document.createElement("a");
      var originURL;
      function resolveURL(url) {
        var href = url;
        if (msie) {
          urlParsingNode.setAttribute("href", href);
          href = urlParsingNode.href;
        }
        urlParsingNode.setAttribute("href", href);
        return {
          href: urlParsingNode.href,
          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, "") : "",
          host: urlParsingNode.host,
          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, "") : "",
          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, "") : "",
          hostname: urlParsingNode.hostname,
          port: urlParsingNode.port,
          pathname: urlParsingNode.pathname.charAt(0) === "/" ? urlParsingNode.pathname : "/" + urlParsingNode.pathname
        };
      }
      originURL = resolveURL(window.location.href);
      return function isURLSameOrigin(requestURL) {
        var parsed = utils.isString(requestURL) ? resolveURL(requestURL) : requestURL;
        return parsed.protocol === originURL.protocol && parsed.host === originURL.host;
      };
    }() : function nonStandardBrowserEnv() {
      return function isURLSameOrigin() {
        return true;
      };
    }();
  }
});

// node_modules/axios/lib/adapters/xhr.js
var require_xhr = __commonJS({
  "node_modules/axios/lib/adapters/xhr.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var settle = require_settle();
    var cookies = require_cookies();
    var buildURL = require_buildURL();
    var buildFullPath = require_buildFullPath();
    var parseHeaders = require_parseHeaders();
    var isURLSameOrigin = require_isURLSameOrigin();
    var createError = require_createError();
    module.exports = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;
        if (utils.isFormData(requestData)) {
          delete requestHeaders["Content-Type"];
        }
        var request = new XMLHttpRequest();
        if (config.auth) {
          var username = config.auth.username || "";
          var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : "";
          requestHeaders.Authorization = "Basic " + btoa(username + ":" + password);
        }
        var fullPath = buildFullPath(config.baseURL, config.url);
        request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);
        request.timeout = config.timeout;
        request.onreadystatechange = function handleLoad() {
          if (!request || request.readyState !== 4) {
            return;
          }
          if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf("file:") === 0)) {
            return;
          }
          var responseHeaders = "getAllResponseHeaders" in request ? parseHeaders(request.getAllResponseHeaders()) : null;
          var responseData = !config.responseType || config.responseType === "text" ? request.responseText : request.response;
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config,
            request
          };
          settle(resolve, reject, response);
          request = null;
        };
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }
          reject(createError("Request aborted", config, "ECONNABORTED", request));
          request = null;
        };
        request.onerror = function handleError() {
          reject(createError("Network Error", config, null, request));
          request = null;
        };
        request.ontimeout = function handleTimeout() {
          var timeoutErrorMessage = "timeout of " + config.timeout + "ms exceeded";
          if (config.timeoutErrorMessage) {
            timeoutErrorMessage = config.timeoutErrorMessage;
          }
          reject(createError(timeoutErrorMessage, config, "ECONNABORTED", request));
          request = null;
        };
        if (utils.isStandardBrowserEnv()) {
          var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ? cookies.read(config.xsrfCookieName) : void 0;
          if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
          }
        }
        if ("setRequestHeader" in request) {
          utils.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === "undefined" && key.toLowerCase() === "content-type") {
              delete requestHeaders[key];
            } else {
              request.setRequestHeader(key, val);
            }
          });
        }
        if (!utils.isUndefined(config.withCredentials)) {
          request.withCredentials = !!config.withCredentials;
        }
        if (config.responseType) {
          try {
            request.responseType = config.responseType;
          } catch (e) {
            if (config.responseType !== "json") {
              throw e;
            }
          }
        }
        if (typeof config.onDownloadProgress === "function") {
          request.addEventListener("progress", config.onDownloadProgress);
        }
        if (typeof config.onUploadProgress === "function" && request.upload) {
          request.upload.addEventListener("progress", config.onUploadProgress);
        }
        if (config.cancelToken) {
          config.cancelToken.promise.then(function onCanceled(cancel) {
            if (!request) {
              return;
            }
            request.abort();
            reject(cancel);
            request = null;
          });
        }
        if (!requestData) {
          requestData = null;
        }
        request.send(requestData);
      });
    };
  }
});

// node_modules/axios/lib/defaults.js
var require_defaults = __commonJS({
  "node_modules/axios/lib/defaults.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var normalizeHeaderName = require_normalizeHeaderName();
    var DEFAULT_CONTENT_TYPE = {
      "Content-Type": "application/x-www-form-urlencoded"
    };
    function setContentTypeIfUnset(headers, value) {
      if (!utils.isUndefined(headers) && utils.isUndefined(headers["Content-Type"])) {
        headers["Content-Type"] = value;
      }
    }
    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== "undefined") {
        adapter = require_xhr();
      } else if (typeof process !== "undefined" && Object.prototype.toString.call(process) === "[object process]") {
        adapter = require_xhr();
      }
      return adapter;
    }
    var defaults = {
      adapter: getDefaultAdapter(),
      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, "Accept");
        normalizeHeaderName(headers, "Content-Type");
        if (utils.isFormData(data) || utils.isArrayBuffer(data) || utils.isBuffer(data) || utils.isStream(data) || utils.isFile(data) || utils.isBlob(data)) {
          return data;
        }
        if (utils.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, "application/x-www-form-urlencoded;charset=utf-8");
          return data.toString();
        }
        if (utils.isObject(data)) {
          setContentTypeIfUnset(headers, "application/json;charset=utf-8");
          return JSON.stringify(data);
        }
        return data;
      }],
      transformResponse: [function transformResponse(data) {
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch (e) {
          }
        }
        return data;
      }],
      timeout: 0,
      xsrfCookieName: "XSRF-TOKEN",
      xsrfHeaderName: "X-XSRF-TOKEN",
      maxContentLength: -1,
      maxBodyLength: -1,
      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      }
    };
    defaults.headers = {
      common: {
        "Accept": "application/json, text/plain, */*"
      }
    };
    utils.forEach(["delete", "get", "head"], function forEachMethodNoData(method) {
      defaults.headers[method] = {};
    });
    utils.forEach(["post", "put", "patch"], function forEachMethodWithData(method) {
      defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
    });
    module.exports = defaults;
  }
});

// node_modules/axios/lib/core/dispatchRequest.js
var require_dispatchRequest = __commonJS({
  "node_modules/axios/lib/core/dispatchRequest.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var transformData = require_transformData();
    var isCancel = require_isCancel();
    var defaults = require_defaults();
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }
    }
    module.exports = function dispatchRequest(config) {
      throwIfCancellationRequested(config);
      config.headers = config.headers || {};
      config.data = transformData(config.data, config.headers, config.transformRequest);
      config.headers = utils.merge(config.headers.common || {}, config.headers[config.method] || {}, config.headers);
      utils.forEach(["delete", "get", "head", "post", "put", "patch", "common"], function cleanHeaderConfig(method) {
        delete config.headers[method];
      });
      var adapter = config.adapter || defaults.adapter;
      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);
        response.data = transformData(response.data, response.headers, config.transformResponse);
        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);
          if (reason && reason.response) {
            reason.response.data = transformData(reason.response.data, reason.response.headers, config.transformResponse);
          }
        }
        return Promise.reject(reason);
      });
    };
  }
});

// node_modules/axios/lib/core/mergeConfig.js
var require_mergeConfig = __commonJS({
  "node_modules/axios/lib/core/mergeConfig.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    module.exports = function mergeConfig(config1, config2) {
      config2 = config2 || {};
      var config = {};
      var valueFromConfig2Keys = ["url", "method", "data"];
      var mergeDeepPropertiesKeys = ["headers", "auth", "proxy", "params"];
      var defaultToConfig2Keys = [
        "baseURL",
        "transformRequest",
        "transformResponse",
        "paramsSerializer",
        "timeout",
        "timeoutMessage",
        "withCredentials",
        "adapter",
        "responseType",
        "xsrfCookieName",
        "xsrfHeaderName",
        "onUploadProgress",
        "onDownloadProgress",
        "decompress",
        "maxContentLength",
        "maxBodyLength",
        "maxRedirects",
        "transport",
        "httpAgent",
        "httpsAgent",
        "cancelToken",
        "socketPath",
        "responseEncoding"
      ];
      var directMergeKeys = ["validateStatus"];
      function getMergedValue(target, source) {
        if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
          return utils.merge(target, source);
        } else if (utils.isPlainObject(source)) {
          return utils.merge({}, source);
        } else if (utils.isArray(source)) {
          return source.slice();
        }
        return source;
      }
      function mergeDeepProperties(prop) {
        if (!utils.isUndefined(config2[prop])) {
          config[prop] = getMergedValue(config1[prop], config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          config[prop] = getMergedValue(void 0, config1[prop]);
        }
      }
      utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          config[prop] = getMergedValue(void 0, config2[prop]);
        }
      });
      utils.forEach(mergeDeepPropertiesKeys, mergeDeepProperties);
      utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          config[prop] = getMergedValue(void 0, config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          config[prop] = getMergedValue(void 0, config1[prop]);
        }
      });
      utils.forEach(directMergeKeys, function merge(prop) {
        if (prop in config2) {
          config[prop] = getMergedValue(config1[prop], config2[prop]);
        } else if (prop in config1) {
          config[prop] = getMergedValue(void 0, config1[prop]);
        }
      });
      var axiosKeys = valueFromConfig2Keys.concat(mergeDeepPropertiesKeys).concat(defaultToConfig2Keys).concat(directMergeKeys);
      var otherKeys = Object.keys(config1).concat(Object.keys(config2)).filter(function filterAxiosKeys(key) {
        return axiosKeys.indexOf(key) === -1;
      });
      utils.forEach(otherKeys, mergeDeepProperties);
      return config;
    };
  }
});

// node_modules/axios/lib/core/Axios.js
var require_Axios = __commonJS({
  "node_modules/axios/lib/core/Axios.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var buildURL = require_buildURL();
    var InterceptorManager = require_InterceptorManager();
    var dispatchRequest = require_dispatchRequest();
    var mergeConfig = require_mergeConfig();
    function Axios(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager()
      };
    }
    Axios.prototype.request = function request(config) {
      if (typeof config === "string") {
        config = arguments[1] || {};
        config.url = arguments[0];
      } else {
        config = config || {};
      }
      config = mergeConfig(this.defaults, config);
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = "get";
      }
      var chain = [dispatchRequest, void 0];
      var promise = Promise.resolve(config);
      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        chain.unshift(interceptor.fulfilled, interceptor.rejected);
      });
      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        chain.push(interceptor.fulfilled, interceptor.rejected);
      });
      while (chain.length) {
        promise = promise.then(chain.shift(), chain.shift());
      }
      return promise;
    };
    Axios.prototype.getUri = function getUri(config) {
      config = mergeConfig(this.defaults, config);
      return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, "");
    };
    utils.forEach(["delete", "get", "head", "options"], function forEachMethodNoData(method) {
      Axios.prototype[method] = function(url, config) {
        return this.request(mergeConfig(config || {}, {
          method,
          url,
          data: (config || {}).data
        }));
      };
    });
    utils.forEach(["post", "put", "patch"], function forEachMethodWithData(method) {
      Axios.prototype[method] = function(url, data, config) {
        return this.request(mergeConfig(config || {}, {
          method,
          url,
          data
        }));
      };
    });
    module.exports = Axios;
  }
});

// node_modules/axios/lib/cancel/Cancel.js
var require_Cancel = __commonJS({
  "node_modules/axios/lib/cancel/Cancel.js"(exports, module) {
    "use strict";
    function Cancel(message) {
      this.message = message;
    }
    Cancel.prototype.toString = function toString() {
      return "Cancel" + (this.message ? ": " + this.message : "");
    };
    Cancel.prototype.__CANCEL__ = true;
    module.exports = Cancel;
  }
});

// node_modules/axios/lib/cancel/CancelToken.js
var require_CancelToken = __commonJS({
  "node_modules/axios/lib/cancel/CancelToken.js"(exports, module) {
    "use strict";
    var Cancel = require_Cancel();
    function CancelToken(executor) {
      if (typeof executor !== "function") {
        throw new TypeError("executor must be a function.");
      }
      var resolvePromise;
      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });
      var token = this;
      executor(function cancel(message) {
        if (token.reason) {
          return;
        }
        token.reason = new Cancel(message);
        resolvePromise(token.reason);
      });
    }
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };
    CancelToken.source = function source() {
      var cancel;
      var token = new CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token,
        cancel
      };
    };
    module.exports = CancelToken;
  }
});

// node_modules/axios/lib/helpers/spread.js
var require_spread = __commonJS({
  "node_modules/axios/lib/helpers/spread.js"(exports, module) {
    "use strict";
    module.exports = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };
  }
});

// node_modules/axios/lib/helpers/isAxiosError.js
var require_isAxiosError = __commonJS({
  "node_modules/axios/lib/helpers/isAxiosError.js"(exports, module) {
    "use strict";
    module.exports = function isAxiosError(payload) {
      return typeof payload === "object" && payload.isAxiosError === true;
    };
  }
});

// node_modules/axios/lib/axios.js
var require_axios = __commonJS({
  "node_modules/axios/lib/axios.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var bind = require_bind();
    var Axios = require_Axios();
    var mergeConfig = require_mergeConfig();
    var defaults = require_defaults();
    function createInstance(defaultConfig) {
      var context = new Axios(defaultConfig);
      var instance = bind(Axios.prototype.request, context);
      utils.extend(instance, Axios.prototype, context);
      utils.extend(instance, context);
      return instance;
    }
    var axios2 = createInstance(defaults);
    axios2.Axios = Axios;
    axios2.create = function create(instanceConfig) {
      return createInstance(mergeConfig(axios2.defaults, instanceConfig));
    };
    axios2.Cancel = require_Cancel();
    axios2.CancelToken = require_CancelToken();
    axios2.isCancel = require_isCancel();
    axios2.all = function all(promises) {
      return Promise.all(promises);
    };
    axios2.spread = require_spread();
    axios2.isAxiosError = require_isAxiosError();
    module.exports = axios2;
    module.exports.default = axios2;
  }
});

// node_modules/axios/index.js
var require_axios2 = __commonJS({
  "node_modules/axios/index.js"(exports, module) {
    module.exports = require_axios();
  }
});

// node_modules/lodash/lodash.js
var require_lodash = __commonJS({
  "node_modules/lodash/lodash.js"(exports, module) {
    (function() {
      var undefined2;
      var VERSION = "4.17.21";
      var LARGE_ARRAY_SIZE = 200;
      var CORE_ERROR_TEXT = "Unsupported core-js use. Try https://npms.io/search?q=ponyfill.", FUNC_ERROR_TEXT = "Expected a function", INVALID_TEMPL_VAR_ERROR_TEXT = "Invalid `variable` option passed into `_.template`";
      var HASH_UNDEFINED = "__lodash_hash_undefined__";
      var MAX_MEMOIZE_SIZE = 500;
      var PLACEHOLDER = "__lodash_placeholder__";
      var CLONE_DEEP_FLAG = 1, CLONE_FLAT_FLAG = 2, CLONE_SYMBOLS_FLAG = 4;
      var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
      var WRAP_BIND_FLAG = 1, WRAP_BIND_KEY_FLAG = 2, WRAP_CURRY_BOUND_FLAG = 4, WRAP_CURRY_FLAG = 8, WRAP_CURRY_RIGHT_FLAG = 16, WRAP_PARTIAL_FLAG = 32, WRAP_PARTIAL_RIGHT_FLAG = 64, WRAP_ARY_FLAG = 128, WRAP_REARG_FLAG = 256, WRAP_FLIP_FLAG = 512;
      var DEFAULT_TRUNC_LENGTH = 30, DEFAULT_TRUNC_OMISSION = "...";
      var HOT_COUNT = 800, HOT_SPAN = 16;
      var LAZY_FILTER_FLAG = 1, LAZY_MAP_FLAG = 2, LAZY_WHILE_FLAG = 3;
      var INFINITY = 1 / 0, MAX_SAFE_INTEGER = 9007199254740991, MAX_INTEGER = 17976931348623157e292, NAN = 0 / 0;
      var MAX_ARRAY_LENGTH = 4294967295, MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1, HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;
      var wrapFlags = [
        ["ary", WRAP_ARY_FLAG],
        ["bind", WRAP_BIND_FLAG],
        ["bindKey", WRAP_BIND_KEY_FLAG],
        ["curry", WRAP_CURRY_FLAG],
        ["curryRight", WRAP_CURRY_RIGHT_FLAG],
        ["flip", WRAP_FLIP_FLAG],
        ["partial", WRAP_PARTIAL_FLAG],
        ["partialRight", WRAP_PARTIAL_RIGHT_FLAG],
        ["rearg", WRAP_REARG_FLAG]
      ];
      var argsTag = "[object Arguments]", arrayTag = "[object Array]", asyncTag = "[object AsyncFunction]", boolTag = "[object Boolean]", dateTag = "[object Date]", domExcTag = "[object DOMException]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", nullTag = "[object Null]", objectTag = "[object Object]", promiseTag = "[object Promise]", proxyTag = "[object Proxy]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", undefinedTag = "[object Undefined]", weakMapTag = "[object WeakMap]", weakSetTag = "[object WeakSet]";
      var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
      var reEmptyStringLeading = /\b__p \+= '';/g, reEmptyStringMiddle = /\b(__p \+=) '' \+/g, reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;
      var reEscapedHtml = /&(?:amp|lt|gt|quot|#39);/g, reUnescapedHtml = /[&<>"']/g, reHasEscapedHtml = RegExp(reEscapedHtml.source), reHasUnescapedHtml = RegExp(reUnescapedHtml.source);
      var reEscape = /<%-([\s\S]+?)%>/g, reEvaluate = /<%([\s\S]+?)%>/g, reInterpolate = /<%=([\s\S]+?)%>/g;
      var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/, rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
      var reRegExpChar = /[\\^$.*+?()[\]{}|]/g, reHasRegExpChar = RegExp(reRegExpChar.source);
      var reTrimStart = /^\s+/;
      var reWhitespace = /\s/;
      var reWrapComment = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/, reWrapDetails = /\{\n\/\* \[wrapped with (.+)\] \*/, reSplitDetails = /,? & /;
      var reAsciiWord = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g;
      var reForbiddenIdentifierChars = /[()=,{}\[\]\/\s]/;
      var reEscapeChar = /\\(\\)?/g;
      var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
      var reFlags = /\w*$/;
      var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
      var reIsBinary = /^0b[01]+$/i;
      var reIsHostCtor = /^\[object .+?Constructor\]$/;
      var reIsOctal = /^0o[0-7]+$/i;
      var reIsUint = /^(?:0|[1-9]\d*)$/;
      var reLatin = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g;
      var reNoMatch = /($^)/;
      var reUnescapedString = /['\n\r\u2028\u2029\\]/g;
      var rsAstralRange = "\\ud800-\\udfff", rsComboMarksRange = "\\u0300-\\u036f", reComboHalfMarksRange = "\\ufe20-\\ufe2f", rsComboSymbolsRange = "\\u20d0-\\u20ff", rsComboRange = rsComboMarksRange + reComboHalfMarksRange + rsComboSymbolsRange, rsDingbatRange = "\\u2700-\\u27bf", rsLowerRange = "a-z\\xdf-\\xf6\\xf8-\\xff", rsMathOpRange = "\\xac\\xb1\\xd7\\xf7", rsNonCharRange = "\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf", rsPunctuationRange = "\\u2000-\\u206f", rsSpaceRange = " \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000", rsUpperRange = "A-Z\\xc0-\\xd6\\xd8-\\xde", rsVarRange = "\\ufe0e\\ufe0f", rsBreakRange = rsMathOpRange + rsNonCharRange + rsPunctuationRange + rsSpaceRange;
      var rsApos = "['\u2019]", rsAstral = "[" + rsAstralRange + "]", rsBreak = "[" + rsBreakRange + "]", rsCombo = "[" + rsComboRange + "]", rsDigits = "\\d+", rsDingbat = "[" + rsDingbatRange + "]", rsLower = "[" + rsLowerRange + "]", rsMisc = "[^" + rsAstralRange + rsBreakRange + rsDigits + rsDingbatRange + rsLowerRange + rsUpperRange + "]", rsFitz = "\\ud83c[\\udffb-\\udfff]", rsModifier = "(?:" + rsCombo + "|" + rsFitz + ")", rsNonAstral = "[^" + rsAstralRange + "]", rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}", rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]", rsUpper = "[" + rsUpperRange + "]", rsZWJ = "\\u200d";
      var rsMiscLower = "(?:" + rsLower + "|" + rsMisc + ")", rsMiscUpper = "(?:" + rsUpper + "|" + rsMisc + ")", rsOptContrLower = "(?:" + rsApos + "(?:d|ll|m|re|s|t|ve))?", rsOptContrUpper = "(?:" + rsApos + "(?:D|LL|M|RE|S|T|VE))?", reOptMod = rsModifier + "?", rsOptVar = "[" + rsVarRange + "]?", rsOptJoin = "(?:" + rsZWJ + "(?:" + [rsNonAstral, rsRegional, rsSurrPair].join("|") + ")" + rsOptVar + reOptMod + ")*", rsOrdLower = "\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])", rsOrdUpper = "\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])", rsSeq = rsOptVar + reOptMod + rsOptJoin, rsEmoji = "(?:" + [rsDingbat, rsRegional, rsSurrPair].join("|") + ")" + rsSeq, rsSymbol = "(?:" + [rsNonAstral + rsCombo + "?", rsCombo, rsRegional, rsSurrPair, rsAstral].join("|") + ")";
      var reApos = RegExp(rsApos, "g");
      var reComboMark = RegExp(rsCombo, "g");
      var reUnicode = RegExp(rsFitz + "(?=" + rsFitz + ")|" + rsSymbol + rsSeq, "g");
      var reUnicodeWord = RegExp([
        rsUpper + "?" + rsLower + "+" + rsOptContrLower + "(?=" + [rsBreak, rsUpper, "$"].join("|") + ")",
        rsMiscUpper + "+" + rsOptContrUpper + "(?=" + [rsBreak, rsUpper + rsMiscLower, "$"].join("|") + ")",
        rsUpper + "?" + rsMiscLower + "+" + rsOptContrLower,
        rsUpper + "+" + rsOptContrUpper,
        rsOrdUpper,
        rsOrdLower,
        rsDigits,
        rsEmoji
      ].join("|"), "g");
      var reHasUnicode = RegExp("[" + rsZWJ + rsAstralRange + rsComboRange + rsVarRange + "]");
      var reHasUnicodeWord = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/;
      var contextProps = [
        "Array",
        "Buffer",
        "DataView",
        "Date",
        "Error",
        "Float32Array",
        "Float64Array",
        "Function",
        "Int8Array",
        "Int16Array",
        "Int32Array",
        "Map",
        "Math",
        "Object",
        "Promise",
        "RegExp",
        "Set",
        "String",
        "Symbol",
        "TypeError",
        "Uint8Array",
        "Uint8ClampedArray",
        "Uint16Array",
        "Uint32Array",
        "WeakMap",
        "_",
        "clearTimeout",
        "isFinite",
        "parseInt",
        "setTimeout"
      ];
      var templateCounter = -1;
      var typedArrayTags = {};
      typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
      typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
      var cloneableTags = {};
      cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[setTag] = cloneableTags[stringTag] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
      cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
      var deburredLetters = {
        "\xC0": "A",
        "\xC1": "A",
        "\xC2": "A",
        "\xC3": "A",
        "\xC4": "A",
        "\xC5": "A",
        "\xE0": "a",
        "\xE1": "a",
        "\xE2": "a",
        "\xE3": "a",
        "\xE4": "a",
        "\xE5": "a",
        "\xC7": "C",
        "\xE7": "c",
        "\xD0": "D",
        "\xF0": "d",
        "\xC8": "E",
        "\xC9": "E",
        "\xCA": "E",
        "\xCB": "E",
        "\xE8": "e",
        "\xE9": "e",
        "\xEA": "e",
        "\xEB": "e",
        "\xCC": "I",
        "\xCD": "I",
        "\xCE": "I",
        "\xCF": "I",
        "\xEC": "i",
        "\xED": "i",
        "\xEE": "i",
        "\xEF": "i",
        "\xD1": "N",
        "\xF1": "n",
        "\xD2": "O",
        "\xD3": "O",
        "\xD4": "O",
        "\xD5": "O",
        "\xD6": "O",
        "\xD8": "O",
        "\xF2": "o",
        "\xF3": "o",
        "\xF4": "o",
        "\xF5": "o",
        "\xF6": "o",
        "\xF8": "o",
        "\xD9": "U",
        "\xDA": "U",
        "\xDB": "U",
        "\xDC": "U",
        "\xF9": "u",
        "\xFA": "u",
        "\xFB": "u",
        "\xFC": "u",
        "\xDD": "Y",
        "\xFD": "y",
        "\xFF": "y",
        "\xC6": "Ae",
        "\xE6": "ae",
        "\xDE": "Th",
        "\xFE": "th",
        "\xDF": "ss",
        "\u0100": "A",
        "\u0102": "A",
        "\u0104": "A",
        "\u0101": "a",
        "\u0103": "a",
        "\u0105": "a",
        "\u0106": "C",
        "\u0108": "C",
        "\u010A": "C",
        "\u010C": "C",
        "\u0107": "c",
        "\u0109": "c",
        "\u010B": "c",
        "\u010D": "c",
        "\u010E": "D",
        "\u0110": "D",
        "\u010F": "d",
        "\u0111": "d",
        "\u0112": "E",
        "\u0114": "E",
        "\u0116": "E",
        "\u0118": "E",
        "\u011A": "E",
        "\u0113": "e",
        "\u0115": "e",
        "\u0117": "e",
        "\u0119": "e",
        "\u011B": "e",
        "\u011C": "G",
        "\u011E": "G",
        "\u0120": "G",
        "\u0122": "G",
        "\u011D": "g",
        "\u011F": "g",
        "\u0121": "g",
        "\u0123": "g",
        "\u0124": "H",
        "\u0126": "H",
        "\u0125": "h",
        "\u0127": "h",
        "\u0128": "I",
        "\u012A": "I",
        "\u012C": "I",
        "\u012E": "I",
        "\u0130": "I",
        "\u0129": "i",
        "\u012B": "i",
        "\u012D": "i",
        "\u012F": "i",
        "\u0131": "i",
        "\u0134": "J",
        "\u0135": "j",
        "\u0136": "K",
        "\u0137": "k",
        "\u0138": "k",
        "\u0139": "L",
        "\u013B": "L",
        "\u013D": "L",
        "\u013F": "L",
        "\u0141": "L",
        "\u013A": "l",
        "\u013C": "l",
        "\u013E": "l",
        "\u0140": "l",
        "\u0142": "l",
        "\u0143": "N",
        "\u0145": "N",
        "\u0147": "N",
        "\u014A": "N",
        "\u0144": "n",
        "\u0146": "n",
        "\u0148": "n",
        "\u014B": "n",
        "\u014C": "O",
        "\u014E": "O",
        "\u0150": "O",
        "\u014D": "o",
        "\u014F": "o",
        "\u0151": "o",
        "\u0154": "R",
        "\u0156": "R",
        "\u0158": "R",
        "\u0155": "r",
        "\u0157": "r",
        "\u0159": "r",
        "\u015A": "S",
        "\u015C": "S",
        "\u015E": "S",
        "\u0160": "S",
        "\u015B": "s",
        "\u015D": "s",
        "\u015F": "s",
        "\u0161": "s",
        "\u0162": "T",
        "\u0164": "T",
        "\u0166": "T",
        "\u0163": "t",
        "\u0165": "t",
        "\u0167": "t",
        "\u0168": "U",
        "\u016A": "U",
        "\u016C": "U",
        "\u016E": "U",
        "\u0170": "U",
        "\u0172": "U",
        "\u0169": "u",
        "\u016B": "u",
        "\u016D": "u",
        "\u016F": "u",
        "\u0171": "u",
        "\u0173": "u",
        "\u0174": "W",
        "\u0175": "w",
        "\u0176": "Y",
        "\u0177": "y",
        "\u0178": "Y",
        "\u0179": "Z",
        "\u017B": "Z",
        "\u017D": "Z",
        "\u017A": "z",
        "\u017C": "z",
        "\u017E": "z",
        "\u0132": "IJ",
        "\u0133": "ij",
        "\u0152": "Oe",
        "\u0153": "oe",
        "\u0149": "'n",
        "\u017F": "s"
      };
      var htmlEscapes = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      var htmlUnescapes = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'"
      };
      var stringEscapes = {
        "\\": "\\",
        "'": "'",
        "\n": "n",
        "\r": "r",
        "\u2028": "u2028",
        "\u2029": "u2029"
      };
      var freeParseFloat = parseFloat, freeParseInt = parseInt;
      var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
      var freeSelf = typeof self == "object" && self && self.Object === Object && self;
      var root = freeGlobal || freeSelf || Function("return this")();
      var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
      var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
      var moduleExports = freeModule && freeModule.exports === freeExports;
      var freeProcess = moduleExports && freeGlobal.process;
      var nodeUtil = function() {
        try {
          var types = freeModule && freeModule.require && freeModule.require("util").types;
          if (types) {
            return types;
          }
          return freeProcess && freeProcess.binding && freeProcess.binding("util");
        } catch (e) {
        }
      }();
      var nodeIsArrayBuffer = nodeUtil && nodeUtil.isArrayBuffer, nodeIsDate = nodeUtil && nodeUtil.isDate, nodeIsMap = nodeUtil && nodeUtil.isMap, nodeIsRegExp = nodeUtil && nodeUtil.isRegExp, nodeIsSet = nodeUtil && nodeUtil.isSet, nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
      function apply(func, thisArg, args) {
        switch (args.length) {
          case 0:
            return func.call(thisArg);
          case 1:
            return func.call(thisArg, args[0]);
          case 2:
            return func.call(thisArg, args[0], args[1]);
          case 3:
            return func.call(thisArg, args[0], args[1], args[2]);
        }
        return func.apply(thisArg, args);
      }
      function arrayAggregator(array, setter, iteratee, accumulator) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          var value = array[index];
          setter(accumulator, value, iteratee(value), array);
        }
        return accumulator;
      }
      function arrayEach(array, iteratee) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          if (iteratee(array[index], index, array) === false) {
            break;
          }
        }
        return array;
      }
      function arrayEachRight(array, iteratee) {
        var length = array == null ? 0 : array.length;
        while (length--) {
          if (iteratee(array[length], length, array) === false) {
            break;
          }
        }
        return array;
      }
      function arrayEvery(array, predicate) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          if (!predicate(array[index], index, array)) {
            return false;
          }
        }
        return true;
      }
      function arrayFilter(array, predicate) {
        var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
        while (++index < length) {
          var value = array[index];
          if (predicate(value, index, array)) {
            result[resIndex++] = value;
          }
        }
        return result;
      }
      function arrayIncludes(array, value) {
        var length = array == null ? 0 : array.length;
        return !!length && baseIndexOf(array, value, 0) > -1;
      }
      function arrayIncludesWith(array, value, comparator) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          if (comparator(value, array[index])) {
            return true;
          }
        }
        return false;
      }
      function arrayMap(array, iteratee) {
        var index = -1, length = array == null ? 0 : array.length, result = Array(length);
        while (++index < length) {
          result[index] = iteratee(array[index], index, array);
        }
        return result;
      }
      function arrayPush(array, values) {
        var index = -1, length = values.length, offset = array.length;
        while (++index < length) {
          array[offset + index] = values[index];
        }
        return array;
      }
      function arrayReduce(array, iteratee, accumulator, initAccum) {
        var index = -1, length = array == null ? 0 : array.length;
        if (initAccum && length) {
          accumulator = array[++index];
        }
        while (++index < length) {
          accumulator = iteratee(accumulator, array[index], index, array);
        }
        return accumulator;
      }
      function arrayReduceRight(array, iteratee, accumulator, initAccum) {
        var length = array == null ? 0 : array.length;
        if (initAccum && length) {
          accumulator = array[--length];
        }
        while (length--) {
          accumulator = iteratee(accumulator, array[length], length, array);
        }
        return accumulator;
      }
      function arraySome(array, predicate) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          if (predicate(array[index], index, array)) {
            return true;
          }
        }
        return false;
      }
      var asciiSize = baseProperty("length");
      function asciiToArray(string) {
        return string.split("");
      }
      function asciiWords(string) {
        return string.match(reAsciiWord) || [];
      }
      function baseFindKey(collection, predicate, eachFunc) {
        var result;
        eachFunc(collection, function(value, key, collection2) {
          if (predicate(value, key, collection2)) {
            result = key;
            return false;
          }
        });
        return result;
      }
      function baseFindIndex(array, predicate, fromIndex, fromRight) {
        var length = array.length, index = fromIndex + (fromRight ? 1 : -1);
        while (fromRight ? index-- : ++index < length) {
          if (predicate(array[index], index, array)) {
            return index;
          }
        }
        return -1;
      }
      function baseIndexOf(array, value, fromIndex) {
        return value === value ? strictIndexOf(array, value, fromIndex) : baseFindIndex(array, baseIsNaN, fromIndex);
      }
      function baseIndexOfWith(array, value, fromIndex, comparator) {
        var index = fromIndex - 1, length = array.length;
        while (++index < length) {
          if (comparator(array[index], value)) {
            return index;
          }
        }
        return -1;
      }
      function baseIsNaN(value) {
        return value !== value;
      }
      function baseMean(array, iteratee) {
        var length = array == null ? 0 : array.length;
        return length ? baseSum(array, iteratee) / length : NAN;
      }
      function baseProperty(key) {
        return function(object) {
          return object == null ? undefined2 : object[key];
        };
      }
      function basePropertyOf(object) {
        return function(key) {
          return object == null ? undefined2 : object[key];
        };
      }
      function baseReduce(collection, iteratee, accumulator, initAccum, eachFunc) {
        eachFunc(collection, function(value, index, collection2) {
          accumulator = initAccum ? (initAccum = false, value) : iteratee(accumulator, value, index, collection2);
        });
        return accumulator;
      }
      function baseSortBy(array, comparer) {
        var length = array.length;
        array.sort(comparer);
        while (length--) {
          array[length] = array[length].value;
        }
        return array;
      }
      function baseSum(array, iteratee) {
        var result, index = -1, length = array.length;
        while (++index < length) {
          var current = iteratee(array[index]);
          if (current !== undefined2) {
            result = result === undefined2 ? current : result + current;
          }
        }
        return result;
      }
      function baseTimes(n, iteratee) {
        var index = -1, result = Array(n);
        while (++index < n) {
          result[index] = iteratee(index);
        }
        return result;
      }
      function baseToPairs(object, props) {
        return arrayMap(props, function(key) {
          return [key, object[key]];
        });
      }
      function baseTrim(string) {
        return string ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, "") : string;
      }
      function baseUnary(func) {
        return function(value) {
          return func(value);
        };
      }
      function baseValues(object, props) {
        return arrayMap(props, function(key) {
          return object[key];
        });
      }
      function cacheHas(cache, key) {
        return cache.has(key);
      }
      function charsStartIndex(strSymbols, chrSymbols) {
        var index = -1, length = strSymbols.length;
        while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {
        }
        return index;
      }
      function charsEndIndex(strSymbols, chrSymbols) {
        var index = strSymbols.length;
        while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {
        }
        return index;
      }
      function countHolders(array, placeholder) {
        var length = array.length, result = 0;
        while (length--) {
          if (array[length] === placeholder) {
            ++result;
          }
        }
        return result;
      }
      var deburrLetter = basePropertyOf(deburredLetters);
      var escapeHtmlChar = basePropertyOf(htmlEscapes);
      function escapeStringChar(chr) {
        return "\\" + stringEscapes[chr];
      }
      function getValue(object, key) {
        return object == null ? undefined2 : object[key];
      }
      function hasUnicode(string) {
        return reHasUnicode.test(string);
      }
      function hasUnicodeWord(string) {
        return reHasUnicodeWord.test(string);
      }
      function iteratorToArray(iterator) {
        var data, result = [];
        while (!(data = iterator.next()).done) {
          result.push(data.value);
        }
        return result;
      }
      function mapToArray(map) {
        var index = -1, result = Array(map.size);
        map.forEach(function(value, key) {
          result[++index] = [key, value];
        });
        return result;
      }
      function overArg(func, transform) {
        return function(arg) {
          return func(transform(arg));
        };
      }
      function replaceHolders(array, placeholder) {
        var index = -1, length = array.length, resIndex = 0, result = [];
        while (++index < length) {
          var value = array[index];
          if (value === placeholder || value === PLACEHOLDER) {
            array[index] = PLACEHOLDER;
            result[resIndex++] = index;
          }
        }
        return result;
      }
      function setToArray(set) {
        var index = -1, result = Array(set.size);
        set.forEach(function(value) {
          result[++index] = value;
        });
        return result;
      }
      function setToPairs(set) {
        var index = -1, result = Array(set.size);
        set.forEach(function(value) {
          result[++index] = [value, value];
        });
        return result;
      }
      function strictIndexOf(array, value, fromIndex) {
        var index = fromIndex - 1, length = array.length;
        while (++index < length) {
          if (array[index] === value) {
            return index;
          }
        }
        return -1;
      }
      function strictLastIndexOf(array, value, fromIndex) {
        var index = fromIndex + 1;
        while (index--) {
          if (array[index] === value) {
            return index;
          }
        }
        return index;
      }
      function stringSize(string) {
        return hasUnicode(string) ? unicodeSize(string) : asciiSize(string);
      }
      function stringToArray(string) {
        return hasUnicode(string) ? unicodeToArray(string) : asciiToArray(string);
      }
      function trimmedEndIndex(string) {
        var index = string.length;
        while (index-- && reWhitespace.test(string.charAt(index))) {
        }
        return index;
      }
      var unescapeHtmlChar = basePropertyOf(htmlUnescapes);
      function unicodeSize(string) {
        var result = reUnicode.lastIndex = 0;
        while (reUnicode.test(string)) {
          ++result;
        }
        return result;
      }
      function unicodeToArray(string) {
        return string.match(reUnicode) || [];
      }
      function unicodeWords(string) {
        return string.match(reUnicodeWord) || [];
      }
      var runInContext = function runInContext2(context) {
        context = context == null ? root : _2.defaults(root.Object(), context, _2.pick(root, contextProps));
        var Array2 = context.Array, Date2 = context.Date, Error2 = context.Error, Function2 = context.Function, Math2 = context.Math, Object2 = context.Object, RegExp2 = context.RegExp, String2 = context.String, TypeError2 = context.TypeError;
        var arrayProto = Array2.prototype, funcProto = Function2.prototype, objectProto = Object2.prototype;
        var coreJsData = context["__core-js_shared__"];
        var funcToString = funcProto.toString;
        var hasOwnProperty = objectProto.hasOwnProperty;
        var idCounter = 0;
        var maskSrcKey = function() {
          var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
          return uid ? "Symbol(src)_1." + uid : "";
        }();
        var nativeObjectToString = objectProto.toString;
        var objectCtorString = funcToString.call(Object2);
        var oldDash = root._;
        var reIsNative = RegExp2("^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
        var Buffer2 = moduleExports ? context.Buffer : undefined2, Symbol = context.Symbol, Uint8Array2 = context.Uint8Array, allocUnsafe = Buffer2 ? Buffer2.allocUnsafe : undefined2, getPrototype = overArg(Object2.getPrototypeOf, Object2), objectCreate = Object2.create, propertyIsEnumerable = objectProto.propertyIsEnumerable, splice = arrayProto.splice, spreadableSymbol = Symbol ? Symbol.isConcatSpreadable : undefined2, symIterator = Symbol ? Symbol.iterator : undefined2, symToStringTag = Symbol ? Symbol.toStringTag : undefined2;
        var defineProperty = function() {
          try {
            var func = getNative(Object2, "defineProperty");
            func({}, "", {});
            return func;
          } catch (e) {
          }
        }();
        var ctxClearTimeout = context.clearTimeout !== root.clearTimeout && context.clearTimeout, ctxNow = Date2 && Date2.now !== root.Date.now && Date2.now, ctxSetTimeout = context.setTimeout !== root.setTimeout && context.setTimeout;
        var nativeCeil = Math2.ceil, nativeFloor = Math2.floor, nativeGetSymbols = Object2.getOwnPropertySymbols, nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : undefined2, nativeIsFinite = context.isFinite, nativeJoin = arrayProto.join, nativeKeys = overArg(Object2.keys, Object2), nativeMax = Math2.max, nativeMin = Math2.min, nativeNow = Date2.now, nativeParseInt = context.parseInt, nativeRandom = Math2.random, nativeReverse = arrayProto.reverse;
        var DataView = getNative(context, "DataView"), Map = getNative(context, "Map"), Promise2 = getNative(context, "Promise"), Set = getNative(context, "Set"), WeakMap2 = getNative(context, "WeakMap"), nativeCreate = getNative(Object2, "create");
        var metaMap = WeakMap2 && new WeakMap2();
        var realNames = {};
        var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map), promiseCtorString = toSource(Promise2), setCtorString = toSource(Set), weakMapCtorString = toSource(WeakMap2);
        var symbolProto = Symbol ? Symbol.prototype : undefined2, symbolValueOf = symbolProto ? symbolProto.valueOf : undefined2, symbolToString = symbolProto ? symbolProto.toString : undefined2;
        function lodash(value) {
          if (isObjectLike(value) && !isArray(value) && !(value instanceof LazyWrapper)) {
            if (value instanceof LodashWrapper) {
              return value;
            }
            if (hasOwnProperty.call(value, "__wrapped__")) {
              return wrapperClone(value);
            }
          }
          return new LodashWrapper(value);
        }
        var baseCreate = function() {
          function object() {
          }
          return function(proto) {
            if (!isObject(proto)) {
              return {};
            }
            if (objectCreate) {
              return objectCreate(proto);
            }
            object.prototype = proto;
            var result2 = new object();
            object.prototype = undefined2;
            return result2;
          };
        }();
        function baseLodash() {
        }
        function LodashWrapper(value, chainAll) {
          this.__wrapped__ = value;
          this.__actions__ = [];
          this.__chain__ = !!chainAll;
          this.__index__ = 0;
          this.__values__ = undefined2;
        }
        lodash.templateSettings = {
          "escape": reEscape,
          "evaluate": reEvaluate,
          "interpolate": reInterpolate,
          "variable": "",
          "imports": {
            "_": lodash
          }
        };
        lodash.prototype = baseLodash.prototype;
        lodash.prototype.constructor = lodash;
        LodashWrapper.prototype = baseCreate(baseLodash.prototype);
        LodashWrapper.prototype.constructor = LodashWrapper;
        function LazyWrapper(value) {
          this.__wrapped__ = value;
          this.__actions__ = [];
          this.__dir__ = 1;
          this.__filtered__ = false;
          this.__iteratees__ = [];
          this.__takeCount__ = MAX_ARRAY_LENGTH;
          this.__views__ = [];
        }
        function lazyClone() {
          var result2 = new LazyWrapper(this.__wrapped__);
          result2.__actions__ = copyArray(this.__actions__);
          result2.__dir__ = this.__dir__;
          result2.__filtered__ = this.__filtered__;
          result2.__iteratees__ = copyArray(this.__iteratees__);
          result2.__takeCount__ = this.__takeCount__;
          result2.__views__ = copyArray(this.__views__);
          return result2;
        }
        function lazyReverse() {
          if (this.__filtered__) {
            var result2 = new LazyWrapper(this);
            result2.__dir__ = -1;
            result2.__filtered__ = true;
          } else {
            result2 = this.clone();
            result2.__dir__ *= -1;
          }
          return result2;
        }
        function lazyValue() {
          var array = this.__wrapped__.value(), dir = this.__dir__, isArr = isArray(array), isRight = dir < 0, arrLength = isArr ? array.length : 0, view = getView(0, arrLength, this.__views__), start = view.start, end = view.end, length = end - start, index = isRight ? end : start - 1, iteratees = this.__iteratees__, iterLength = iteratees.length, resIndex = 0, takeCount = nativeMin(length, this.__takeCount__);
          if (!isArr || !isRight && arrLength == length && takeCount == length) {
            return baseWrapperValue(array, this.__actions__);
          }
          var result2 = [];
          outer:
            while (length-- && resIndex < takeCount) {
              index += dir;
              var iterIndex = -1, value = array[index];
              while (++iterIndex < iterLength) {
                var data = iteratees[iterIndex], iteratee2 = data.iteratee, type = data.type, computed = iteratee2(value);
                if (type == LAZY_MAP_FLAG) {
                  value = computed;
                } else if (!computed) {
                  if (type == LAZY_FILTER_FLAG) {
                    continue outer;
                  } else {
                    break outer;
                  }
                }
              }
              result2[resIndex++] = value;
            }
          return result2;
        }
        LazyWrapper.prototype = baseCreate(baseLodash.prototype);
        LazyWrapper.prototype.constructor = LazyWrapper;
        function Hash2(entries) {
          var index = -1, length = entries == null ? 0 : entries.length;
          this.clear();
          while (++index < length) {
            var entry = entries[index];
            this.set(entry[0], entry[1]);
          }
        }
        function hashClear() {
          this.__data__ = nativeCreate ? nativeCreate(null) : {};
          this.size = 0;
        }
        function hashDelete(key) {
          var result2 = this.has(key) && delete this.__data__[key];
          this.size -= result2 ? 1 : 0;
          return result2;
        }
        function hashGet(key) {
          var data = this.__data__;
          if (nativeCreate) {
            var result2 = data[key];
            return result2 === HASH_UNDEFINED ? undefined2 : result2;
          }
          return hasOwnProperty.call(data, key) ? data[key] : undefined2;
        }
        function hashHas(key) {
          var data = this.__data__;
          return nativeCreate ? data[key] !== undefined2 : hasOwnProperty.call(data, key);
        }
        function hashSet(key, value) {
          var data = this.__data__;
          this.size += this.has(key) ? 0 : 1;
          data[key] = nativeCreate && value === undefined2 ? HASH_UNDEFINED : value;
          return this;
        }
        Hash2.prototype.clear = hashClear;
        Hash2.prototype["delete"] = hashDelete;
        Hash2.prototype.get = hashGet;
        Hash2.prototype.has = hashHas;
        Hash2.prototype.set = hashSet;
        function ListCache(entries) {
          var index = -1, length = entries == null ? 0 : entries.length;
          this.clear();
          while (++index < length) {
            var entry = entries[index];
            this.set(entry[0], entry[1]);
          }
        }
        function listCacheClear() {
          this.__data__ = [];
          this.size = 0;
        }
        function listCacheDelete(key) {
          var data = this.__data__, index = assocIndexOf(data, key);
          if (index < 0) {
            return false;
          }
          var lastIndex = data.length - 1;
          if (index == lastIndex) {
            data.pop();
          } else {
            splice.call(data, index, 1);
          }
          --this.size;
          return true;
        }
        function listCacheGet(key) {
          var data = this.__data__, index = assocIndexOf(data, key);
          return index < 0 ? undefined2 : data[index][1];
        }
        function listCacheHas(key) {
          return assocIndexOf(this.__data__, key) > -1;
        }
        function listCacheSet(key, value) {
          var data = this.__data__, index = assocIndexOf(data, key);
          if (index < 0) {
            ++this.size;
            data.push([key, value]);
          } else {
            data[index][1] = value;
          }
          return this;
        }
        ListCache.prototype.clear = listCacheClear;
        ListCache.prototype["delete"] = listCacheDelete;
        ListCache.prototype.get = listCacheGet;
        ListCache.prototype.has = listCacheHas;
        ListCache.prototype.set = listCacheSet;
        function MapCache(entries) {
          var index = -1, length = entries == null ? 0 : entries.length;
          this.clear();
          while (++index < length) {
            var entry = entries[index];
            this.set(entry[0], entry[1]);
          }
        }
        function mapCacheClear() {
          this.size = 0;
          this.__data__ = {
            "hash": new Hash2(),
            "map": new (Map || ListCache)(),
            "string": new Hash2()
          };
        }
        function mapCacheDelete(key) {
          var result2 = getMapData(this, key)["delete"](key);
          this.size -= result2 ? 1 : 0;
          return result2;
        }
        function mapCacheGet(key) {
          return getMapData(this, key).get(key);
        }
        function mapCacheHas(key) {
          return getMapData(this, key).has(key);
        }
        function mapCacheSet(key, value) {
          var data = getMapData(this, key), size2 = data.size;
          data.set(key, value);
          this.size += data.size == size2 ? 0 : 1;
          return this;
        }
        MapCache.prototype.clear = mapCacheClear;
        MapCache.prototype["delete"] = mapCacheDelete;
        MapCache.prototype.get = mapCacheGet;
        MapCache.prototype.has = mapCacheHas;
        MapCache.prototype.set = mapCacheSet;
        function SetCache(values2) {
          var index = -1, length = values2 == null ? 0 : values2.length;
          this.__data__ = new MapCache();
          while (++index < length) {
            this.add(values2[index]);
          }
        }
        function setCacheAdd(value) {
          this.__data__.set(value, HASH_UNDEFINED);
          return this;
        }
        function setCacheHas(value) {
          return this.__data__.has(value);
        }
        SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
        SetCache.prototype.has = setCacheHas;
        function Stack2(entries) {
          var data = this.__data__ = new ListCache(entries);
          this.size = data.size;
        }
        function stackClear() {
          this.__data__ = new ListCache();
          this.size = 0;
        }
        function stackDelete(key) {
          var data = this.__data__, result2 = data["delete"](key);
          this.size = data.size;
          return result2;
        }
        function stackGet(key) {
          return this.__data__.get(key);
        }
        function stackHas(key) {
          return this.__data__.has(key);
        }
        function stackSet(key, value) {
          var data = this.__data__;
          if (data instanceof ListCache) {
            var pairs = data.__data__;
            if (!Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
              pairs.push([key, value]);
              this.size = ++data.size;
              return this;
            }
            data = this.__data__ = new MapCache(pairs);
          }
          data.set(key, value);
          this.size = data.size;
          return this;
        }
        Stack2.prototype.clear = stackClear;
        Stack2.prototype["delete"] = stackDelete;
        Stack2.prototype.get = stackGet;
        Stack2.prototype.has = stackHas;
        Stack2.prototype.set = stackSet;
        function arrayLikeKeys(value, inherited) {
          var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result2 = skipIndexes ? baseTimes(value.length, String2) : [], length = result2.length;
          for (var key in value) {
            if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || isIndex(key, length)))) {
              result2.push(key);
            }
          }
          return result2;
        }
        function arraySample(array) {
          var length = array.length;
          return length ? array[baseRandom(0, length - 1)] : undefined2;
        }
        function arraySampleSize(array, n) {
          return shuffleSelf(copyArray(array), baseClamp(n, 0, array.length));
        }
        function arrayShuffle(array) {
          return shuffleSelf(copyArray(array));
        }
        function assignMergeValue(object, key, value) {
          if (value !== undefined2 && !eq(object[key], value) || value === undefined2 && !(key in object)) {
            baseAssignValue(object, key, value);
          }
        }
        function assignValue(object, key, value) {
          var objValue = object[key];
          if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) || value === undefined2 && !(key in object)) {
            baseAssignValue(object, key, value);
          }
        }
        function assocIndexOf(array, key) {
          var length = array.length;
          while (length--) {
            if (eq(array[length][0], key)) {
              return length;
            }
          }
          return -1;
        }
        function baseAggregator(collection, setter, iteratee2, accumulator) {
          baseEach(collection, function(value, key, collection2) {
            setter(accumulator, value, iteratee2(value), collection2);
          });
          return accumulator;
        }
        function baseAssign(object, source) {
          return object && copyObject(source, keys(source), object);
        }
        function baseAssignIn(object, source) {
          return object && copyObject(source, keysIn(source), object);
        }
        function baseAssignValue(object, key, value) {
          if (key == "__proto__" && defineProperty) {
            defineProperty(object, key, {
              "configurable": true,
              "enumerable": true,
              "value": value,
              "writable": true
            });
          } else {
            object[key] = value;
          }
        }
        function baseAt(object, paths) {
          var index = -1, length = paths.length, result2 = Array2(length), skip = object == null;
          while (++index < length) {
            result2[index] = skip ? undefined2 : get(object, paths[index]);
          }
          return result2;
        }
        function baseClamp(number, lower, upper) {
          if (number === number) {
            if (upper !== undefined2) {
              number = number <= upper ? number : upper;
            }
            if (lower !== undefined2) {
              number = number >= lower ? number : lower;
            }
          }
          return number;
        }
        function baseClone(value, bitmask, customizer, key, object, stack) {
          var result2, isDeep = bitmask & CLONE_DEEP_FLAG, isFlat = bitmask & CLONE_FLAT_FLAG, isFull = bitmask & CLONE_SYMBOLS_FLAG;
          if (customizer) {
            result2 = object ? customizer(value, key, object, stack) : customizer(value);
          }
          if (result2 !== undefined2) {
            return result2;
          }
          if (!isObject(value)) {
            return value;
          }
          var isArr = isArray(value);
          if (isArr) {
            result2 = initCloneArray(value);
            if (!isDeep) {
              return copyArray(value, result2);
            }
          } else {
            var tag = getTag(value), isFunc = tag == funcTag || tag == genTag;
            if (isBuffer(value)) {
              return cloneBuffer(value, isDeep);
            }
            if (tag == objectTag || tag == argsTag || isFunc && !object) {
              result2 = isFlat || isFunc ? {} : initCloneObject(value);
              if (!isDeep) {
                return isFlat ? copySymbolsIn(value, baseAssignIn(result2, value)) : copySymbols(value, baseAssign(result2, value));
              }
            } else {
              if (!cloneableTags[tag]) {
                return object ? value : {};
              }
              result2 = initCloneByTag(value, tag, isDeep);
            }
          }
          stack || (stack = new Stack2());
          var stacked = stack.get(value);
          if (stacked) {
            return stacked;
          }
          stack.set(value, result2);
          if (isSet(value)) {
            value.forEach(function(subValue) {
              result2.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
            });
          } else if (isMap(value)) {
            value.forEach(function(subValue, key2) {
              result2.set(key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
            });
          }
          var keysFunc = isFull ? isFlat ? getAllKeysIn : getAllKeys : isFlat ? keysIn : keys;
          var props = isArr ? undefined2 : keysFunc(value);
          arrayEach(props || value, function(subValue, key2) {
            if (props) {
              key2 = subValue;
              subValue = value[key2];
            }
            assignValue(result2, key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
          });
          return result2;
        }
        function baseConforms(source) {
          var props = keys(source);
          return function(object) {
            return baseConformsTo(object, source, props);
          };
        }
        function baseConformsTo(object, source, props) {
          var length = props.length;
          if (object == null) {
            return !length;
          }
          object = Object2(object);
          while (length--) {
            var key = props[length], predicate = source[key], value = object[key];
            if (value === undefined2 && !(key in object) || !predicate(value)) {
              return false;
            }
          }
          return true;
        }
        function baseDelay(func, wait, args) {
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          return setTimeout(function() {
            func.apply(undefined2, args);
          }, wait);
        }
        function baseDifference(array, values2, iteratee2, comparator) {
          var index = -1, includes2 = arrayIncludes, isCommon = true, length = array.length, result2 = [], valuesLength = values2.length;
          if (!length) {
            return result2;
          }
          if (iteratee2) {
            values2 = arrayMap(values2, baseUnary(iteratee2));
          }
          if (comparator) {
            includes2 = arrayIncludesWith;
            isCommon = false;
          } else if (values2.length >= LARGE_ARRAY_SIZE) {
            includes2 = cacheHas;
            isCommon = false;
            values2 = new SetCache(values2);
          }
          outer:
            while (++index < length) {
              var value = array[index], computed = iteratee2 == null ? value : iteratee2(value);
              value = comparator || value !== 0 ? value : 0;
              if (isCommon && computed === computed) {
                var valuesIndex = valuesLength;
                while (valuesIndex--) {
                  if (values2[valuesIndex] === computed) {
                    continue outer;
                  }
                }
                result2.push(value);
              } else if (!includes2(values2, computed, comparator)) {
                result2.push(value);
              }
            }
          return result2;
        }
        var baseEach = createBaseEach(baseForOwn);
        var baseEachRight = createBaseEach(baseForOwnRight, true);
        function baseEvery(collection, predicate) {
          var result2 = true;
          baseEach(collection, function(value, index, collection2) {
            result2 = !!predicate(value, index, collection2);
            return result2;
          });
          return result2;
        }
        function baseExtremum(array, iteratee2, comparator) {
          var index = -1, length = array.length;
          while (++index < length) {
            var value = array[index], current = iteratee2(value);
            if (current != null && (computed === undefined2 ? current === current && !isSymbol(current) : comparator(current, computed))) {
              var computed = current, result2 = value;
            }
          }
          return result2;
        }
        function baseFill(array, value, start, end) {
          var length = array.length;
          start = toInteger(start);
          if (start < 0) {
            start = -start > length ? 0 : length + start;
          }
          end = end === undefined2 || end > length ? length : toInteger(end);
          if (end < 0) {
            end += length;
          }
          end = start > end ? 0 : toLength(end);
          while (start < end) {
            array[start++] = value;
          }
          return array;
        }
        function baseFilter(collection, predicate) {
          var result2 = [];
          baseEach(collection, function(value, index, collection2) {
            if (predicate(value, index, collection2)) {
              result2.push(value);
            }
          });
          return result2;
        }
        function baseFlatten(array, depth, predicate, isStrict, result2) {
          var index = -1, length = array.length;
          predicate || (predicate = isFlattenable);
          result2 || (result2 = []);
          while (++index < length) {
            var value = array[index];
            if (depth > 0 && predicate(value)) {
              if (depth > 1) {
                baseFlatten(value, depth - 1, predicate, isStrict, result2);
              } else {
                arrayPush(result2, value);
              }
            } else if (!isStrict) {
              result2[result2.length] = value;
            }
          }
          return result2;
        }
        var baseFor = createBaseFor();
        var baseForRight = createBaseFor(true);
        function baseForOwn(object, iteratee2) {
          return object && baseFor(object, iteratee2, keys);
        }
        function baseForOwnRight(object, iteratee2) {
          return object && baseForRight(object, iteratee2, keys);
        }
        function baseFunctions(object, props) {
          return arrayFilter(props, function(key) {
            return isFunction(object[key]);
          });
        }
        function baseGet(object, path) {
          path = castPath(path, object);
          var index = 0, length = path.length;
          while (object != null && index < length) {
            object = object[toKey(path[index++])];
          }
          return index && index == length ? object : undefined2;
        }
        function baseGetAllKeys(object, keysFunc, symbolsFunc) {
          var result2 = keysFunc(object);
          return isArray(object) ? result2 : arrayPush(result2, symbolsFunc(object));
        }
        function baseGetTag(value) {
          if (value == null) {
            return value === undefined2 ? undefinedTag : nullTag;
          }
          return symToStringTag && symToStringTag in Object2(value) ? getRawTag(value) : objectToString(value);
        }
        function baseGt(value, other) {
          return value > other;
        }
        function baseHas(object, key) {
          return object != null && hasOwnProperty.call(object, key);
        }
        function baseHasIn(object, key) {
          return object != null && key in Object2(object);
        }
        function baseInRange(number, start, end) {
          return number >= nativeMin(start, end) && number < nativeMax(start, end);
        }
        function baseIntersection(arrays, iteratee2, comparator) {
          var includes2 = comparator ? arrayIncludesWith : arrayIncludes, length = arrays[0].length, othLength = arrays.length, othIndex = othLength, caches = Array2(othLength), maxLength = Infinity, result2 = [];
          while (othIndex--) {
            var array = arrays[othIndex];
            if (othIndex && iteratee2) {
              array = arrayMap(array, baseUnary(iteratee2));
            }
            maxLength = nativeMin(array.length, maxLength);
            caches[othIndex] = !comparator && (iteratee2 || length >= 120 && array.length >= 120) ? new SetCache(othIndex && array) : undefined2;
          }
          array = arrays[0];
          var index = -1, seen = caches[0];
          outer:
            while (++index < length && result2.length < maxLength) {
              var value = array[index], computed = iteratee2 ? iteratee2(value) : value;
              value = comparator || value !== 0 ? value : 0;
              if (!(seen ? cacheHas(seen, computed) : includes2(result2, computed, comparator))) {
                othIndex = othLength;
                while (--othIndex) {
                  var cache = caches[othIndex];
                  if (!(cache ? cacheHas(cache, computed) : includes2(arrays[othIndex], computed, comparator))) {
                    continue outer;
                  }
                }
                if (seen) {
                  seen.push(computed);
                }
                result2.push(value);
              }
            }
          return result2;
        }
        function baseInverter(object, setter, iteratee2, accumulator) {
          baseForOwn(object, function(value, key, object2) {
            setter(accumulator, iteratee2(value), key, object2);
          });
          return accumulator;
        }
        function baseInvoke(object, path, args) {
          path = castPath(path, object);
          object = parent(object, path);
          var func = object == null ? object : object[toKey(last(path))];
          return func == null ? undefined2 : apply(func, object, args);
        }
        function baseIsArguments(value) {
          return isObjectLike(value) && baseGetTag(value) == argsTag;
        }
        function baseIsArrayBuffer(value) {
          return isObjectLike(value) && baseGetTag(value) == arrayBufferTag;
        }
        function baseIsDate(value) {
          return isObjectLike(value) && baseGetTag(value) == dateTag;
        }
        function baseIsEqual(value, other, bitmask, customizer, stack) {
          if (value === other) {
            return true;
          }
          if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) {
            return value !== value && other !== other;
          }
          return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
        }
        function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
          var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
          objTag = objTag == argsTag ? objectTag : objTag;
          othTag = othTag == argsTag ? objectTag : othTag;
          var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
          if (isSameTag && isBuffer(object)) {
            if (!isBuffer(other)) {
              return false;
            }
            objIsArr = true;
            objIsObj = false;
          }
          if (isSameTag && !objIsObj) {
            stack || (stack = new Stack2());
            return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
          }
          if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
            var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
            if (objIsWrapped || othIsWrapped) {
              var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
              stack || (stack = new Stack2());
              return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
            }
          }
          if (!isSameTag) {
            return false;
          }
          stack || (stack = new Stack2());
          return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
        }
        function baseIsMap(value) {
          return isObjectLike(value) && getTag(value) == mapTag;
        }
        function baseIsMatch(object, source, matchData, customizer) {
          var index = matchData.length, length = index, noCustomizer = !customizer;
          if (object == null) {
            return !length;
          }
          object = Object2(object);
          while (index--) {
            var data = matchData[index];
            if (noCustomizer && data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) {
              return false;
            }
          }
          while (++index < length) {
            data = matchData[index];
            var key = data[0], objValue = object[key], srcValue = data[1];
            if (noCustomizer && data[2]) {
              if (objValue === undefined2 && !(key in object)) {
                return false;
              }
            } else {
              var stack = new Stack2();
              if (customizer) {
                var result2 = customizer(objValue, srcValue, key, object, source, stack);
              }
              if (!(result2 === undefined2 ? baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG, customizer, stack) : result2)) {
                return false;
              }
            }
          }
          return true;
        }
        function baseIsNative(value) {
          if (!isObject(value) || isMasked(value)) {
            return false;
          }
          var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
          return pattern.test(toSource(value));
        }
        function baseIsRegExp(value) {
          return isObjectLike(value) && baseGetTag(value) == regexpTag;
        }
        function baseIsSet(value) {
          return isObjectLike(value) && getTag(value) == setTag;
        }
        function baseIsTypedArray(value) {
          return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
        }
        function baseIteratee(value) {
          if (typeof value == "function") {
            return value;
          }
          if (value == null) {
            return identity;
          }
          if (typeof value == "object") {
            return isArray(value) ? baseMatchesProperty(value[0], value[1]) : baseMatches(value);
          }
          return property(value);
        }
        function baseKeys(object) {
          if (!isPrototype(object)) {
            return nativeKeys(object);
          }
          var result2 = [];
          for (var key in Object2(object)) {
            if (hasOwnProperty.call(object, key) && key != "constructor") {
              result2.push(key);
            }
          }
          return result2;
        }
        function baseKeysIn(object) {
          if (!isObject(object)) {
            return nativeKeysIn(object);
          }
          var isProto = isPrototype(object), result2 = [];
          for (var key in object) {
            if (!(key == "constructor" && (isProto || !hasOwnProperty.call(object, key)))) {
              result2.push(key);
            }
          }
          return result2;
        }
        function baseLt(value, other) {
          return value < other;
        }
        function baseMap(collection, iteratee2) {
          var index = -1, result2 = isArrayLike(collection) ? Array2(collection.length) : [];
          baseEach(collection, function(value, key, collection2) {
            result2[++index] = iteratee2(value, key, collection2);
          });
          return result2;
        }
        function baseMatches(source) {
          var matchData = getMatchData(source);
          if (matchData.length == 1 && matchData[0][2]) {
            return matchesStrictComparable(matchData[0][0], matchData[0][1]);
          }
          return function(object) {
            return object === source || baseIsMatch(object, source, matchData);
          };
        }
        function baseMatchesProperty(path, srcValue) {
          if (isKey(path) && isStrictComparable(srcValue)) {
            return matchesStrictComparable(toKey(path), srcValue);
          }
          return function(object) {
            var objValue = get(object, path);
            return objValue === undefined2 && objValue === srcValue ? hasIn(object, path) : baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
          };
        }
        function baseMerge(object, source, srcIndex, customizer, stack) {
          if (object === source) {
            return;
          }
          baseFor(source, function(srcValue, key) {
            stack || (stack = new Stack2());
            if (isObject(srcValue)) {
              baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
            } else {
              var newValue = customizer ? customizer(safeGet(object, key), srcValue, key + "", object, source, stack) : undefined2;
              if (newValue === undefined2) {
                newValue = srcValue;
              }
              assignMergeValue(object, key, newValue);
            }
          }, keysIn);
        }
        function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
          var objValue = safeGet(object, key), srcValue = safeGet(source, key), stacked = stack.get(srcValue);
          if (stacked) {
            assignMergeValue(object, key, stacked);
            return;
          }
          var newValue = customizer ? customizer(objValue, srcValue, key + "", object, source, stack) : undefined2;
          var isCommon = newValue === undefined2;
          if (isCommon) {
            var isArr = isArray(srcValue), isBuff = !isArr && isBuffer(srcValue), isTyped = !isArr && !isBuff && isTypedArray(srcValue);
            newValue = srcValue;
            if (isArr || isBuff || isTyped) {
              if (isArray(objValue)) {
                newValue = objValue;
              } else if (isArrayLikeObject(objValue)) {
                newValue = copyArray(objValue);
              } else if (isBuff) {
                isCommon = false;
                newValue = cloneBuffer(srcValue, true);
              } else if (isTyped) {
                isCommon = false;
                newValue = cloneTypedArray(srcValue, true);
              } else {
                newValue = [];
              }
            } else if (isPlainObject(srcValue) || isArguments(srcValue)) {
              newValue = objValue;
              if (isArguments(objValue)) {
                newValue = toPlainObject(objValue);
              } else if (!isObject(objValue) || isFunction(objValue)) {
                newValue = initCloneObject(srcValue);
              }
            } else {
              isCommon = false;
            }
          }
          if (isCommon) {
            stack.set(srcValue, newValue);
            mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
            stack["delete"](srcValue);
          }
          assignMergeValue(object, key, newValue);
        }
        function baseNth(array, n) {
          var length = array.length;
          if (!length) {
            return;
          }
          n += n < 0 ? length : 0;
          return isIndex(n, length) ? array[n] : undefined2;
        }
        function baseOrderBy(collection, iteratees, orders) {
          if (iteratees.length) {
            iteratees = arrayMap(iteratees, function(iteratee2) {
              if (isArray(iteratee2)) {
                return function(value) {
                  return baseGet(value, iteratee2.length === 1 ? iteratee2[0] : iteratee2);
                };
              }
              return iteratee2;
            });
          } else {
            iteratees = [identity];
          }
          var index = -1;
          iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
          var result2 = baseMap(collection, function(value, key, collection2) {
            var criteria = arrayMap(iteratees, function(iteratee2) {
              return iteratee2(value);
            });
            return { "criteria": criteria, "index": ++index, "value": value };
          });
          return baseSortBy(result2, function(object, other) {
            return compareMultiple(object, other, orders);
          });
        }
        function basePick(object, paths) {
          return basePickBy(object, paths, function(value, path) {
            return hasIn(object, path);
          });
        }
        function basePickBy(object, paths, predicate) {
          var index = -1, length = paths.length, result2 = {};
          while (++index < length) {
            var path = paths[index], value = baseGet(object, path);
            if (predicate(value, path)) {
              baseSet(result2, castPath(path, object), value);
            }
          }
          return result2;
        }
        function basePropertyDeep(path) {
          return function(object) {
            return baseGet(object, path);
          };
        }
        function basePullAll(array, values2, iteratee2, comparator) {
          var indexOf2 = comparator ? baseIndexOfWith : baseIndexOf, index = -1, length = values2.length, seen = array;
          if (array === values2) {
            values2 = copyArray(values2);
          }
          if (iteratee2) {
            seen = arrayMap(array, baseUnary(iteratee2));
          }
          while (++index < length) {
            var fromIndex = 0, value = values2[index], computed = iteratee2 ? iteratee2(value) : value;
            while ((fromIndex = indexOf2(seen, computed, fromIndex, comparator)) > -1) {
              if (seen !== array) {
                splice.call(seen, fromIndex, 1);
              }
              splice.call(array, fromIndex, 1);
            }
          }
          return array;
        }
        function basePullAt(array, indexes) {
          var length = array ? indexes.length : 0, lastIndex = length - 1;
          while (length--) {
            var index = indexes[length];
            if (length == lastIndex || index !== previous) {
              var previous = index;
              if (isIndex(index)) {
                splice.call(array, index, 1);
              } else {
                baseUnset(array, index);
              }
            }
          }
          return array;
        }
        function baseRandom(lower, upper) {
          return lower + nativeFloor(nativeRandom() * (upper - lower + 1));
        }
        function baseRange(start, end, step, fromRight) {
          var index = -1, length = nativeMax(nativeCeil((end - start) / (step || 1)), 0), result2 = Array2(length);
          while (length--) {
            result2[fromRight ? length : ++index] = start;
            start += step;
          }
          return result2;
        }
        function baseRepeat(string, n) {
          var result2 = "";
          if (!string || n < 1 || n > MAX_SAFE_INTEGER) {
            return result2;
          }
          do {
            if (n % 2) {
              result2 += string;
            }
            n = nativeFloor(n / 2);
            if (n) {
              string += string;
            }
          } while (n);
          return result2;
        }
        function baseRest(func, start) {
          return setToString(overRest(func, start, identity), func + "");
        }
        function baseSample(collection) {
          return arraySample(values(collection));
        }
        function baseSampleSize(collection, n) {
          var array = values(collection);
          return shuffleSelf(array, baseClamp(n, 0, array.length));
        }
        function baseSet(object, path, value, customizer) {
          if (!isObject(object)) {
            return object;
          }
          path = castPath(path, object);
          var index = -1, length = path.length, lastIndex = length - 1, nested = object;
          while (nested != null && ++index < length) {
            var key = toKey(path[index]), newValue = value;
            if (key === "__proto__" || key === "constructor" || key === "prototype") {
              return object;
            }
            if (index != lastIndex) {
              var objValue = nested[key];
              newValue = customizer ? customizer(objValue, key, nested) : undefined2;
              if (newValue === undefined2) {
                newValue = isObject(objValue) ? objValue : isIndex(path[index + 1]) ? [] : {};
              }
            }
            assignValue(nested, key, newValue);
            nested = nested[key];
          }
          return object;
        }
        var baseSetData = !metaMap ? identity : function(func, data) {
          metaMap.set(func, data);
          return func;
        };
        var baseSetToString = !defineProperty ? identity : function(func, string) {
          return defineProperty(func, "toString", {
            "configurable": true,
            "enumerable": false,
            "value": constant(string),
            "writable": true
          });
        };
        function baseShuffle(collection) {
          return shuffleSelf(values(collection));
        }
        function baseSlice(array, start, end) {
          var index = -1, length = array.length;
          if (start < 0) {
            start = -start > length ? 0 : length + start;
          }
          end = end > length ? length : end;
          if (end < 0) {
            end += length;
          }
          length = start > end ? 0 : end - start >>> 0;
          start >>>= 0;
          var result2 = Array2(length);
          while (++index < length) {
            result2[index] = array[index + start];
          }
          return result2;
        }
        function baseSome(collection, predicate) {
          var result2;
          baseEach(collection, function(value, index, collection2) {
            result2 = predicate(value, index, collection2);
            return !result2;
          });
          return !!result2;
        }
        function baseSortedIndex(array, value, retHighest) {
          var low = 0, high = array == null ? low : array.length;
          if (typeof value == "number" && value === value && high <= HALF_MAX_ARRAY_LENGTH) {
            while (low < high) {
              var mid = low + high >>> 1, computed = array[mid];
              if (computed !== null && !isSymbol(computed) && (retHighest ? computed <= value : computed < value)) {
                low = mid + 1;
              } else {
                high = mid;
              }
            }
            return high;
          }
          return baseSortedIndexBy(array, value, identity, retHighest);
        }
        function baseSortedIndexBy(array, value, iteratee2, retHighest) {
          var low = 0, high = array == null ? 0 : array.length;
          if (high === 0) {
            return 0;
          }
          value = iteratee2(value);
          var valIsNaN = value !== value, valIsNull = value === null, valIsSymbol = isSymbol(value), valIsUndefined = value === undefined2;
          while (low < high) {
            var mid = nativeFloor((low + high) / 2), computed = iteratee2(array[mid]), othIsDefined = computed !== undefined2, othIsNull = computed === null, othIsReflexive = computed === computed, othIsSymbol = isSymbol(computed);
            if (valIsNaN) {
              var setLow = retHighest || othIsReflexive;
            } else if (valIsUndefined) {
              setLow = othIsReflexive && (retHighest || othIsDefined);
            } else if (valIsNull) {
              setLow = othIsReflexive && othIsDefined && (retHighest || !othIsNull);
            } else if (valIsSymbol) {
              setLow = othIsReflexive && othIsDefined && !othIsNull && (retHighest || !othIsSymbol);
            } else if (othIsNull || othIsSymbol) {
              setLow = false;
            } else {
              setLow = retHighest ? computed <= value : computed < value;
            }
            if (setLow) {
              low = mid + 1;
            } else {
              high = mid;
            }
          }
          return nativeMin(high, MAX_ARRAY_INDEX);
        }
        function baseSortedUniq(array, iteratee2) {
          var index = -1, length = array.length, resIndex = 0, result2 = [];
          while (++index < length) {
            var value = array[index], computed = iteratee2 ? iteratee2(value) : value;
            if (!index || !eq(computed, seen)) {
              var seen = computed;
              result2[resIndex++] = value === 0 ? 0 : value;
            }
          }
          return result2;
        }
        function baseToNumber(value) {
          if (typeof value == "number") {
            return value;
          }
          if (isSymbol(value)) {
            return NAN;
          }
          return +value;
        }
        function baseToString(value) {
          if (typeof value == "string") {
            return value;
          }
          if (isArray(value)) {
            return arrayMap(value, baseToString) + "";
          }
          if (isSymbol(value)) {
            return symbolToString ? symbolToString.call(value) : "";
          }
          var result2 = value + "";
          return result2 == "0" && 1 / value == -INFINITY ? "-0" : result2;
        }
        function baseUniq(array, iteratee2, comparator) {
          var index = -1, includes2 = arrayIncludes, length = array.length, isCommon = true, result2 = [], seen = result2;
          if (comparator) {
            isCommon = false;
            includes2 = arrayIncludesWith;
          } else if (length >= LARGE_ARRAY_SIZE) {
            var set2 = iteratee2 ? null : createSet(array);
            if (set2) {
              return setToArray(set2);
            }
            isCommon = false;
            includes2 = cacheHas;
            seen = new SetCache();
          } else {
            seen = iteratee2 ? [] : result2;
          }
          outer:
            while (++index < length) {
              var value = array[index], computed = iteratee2 ? iteratee2(value) : value;
              value = comparator || value !== 0 ? value : 0;
              if (isCommon && computed === computed) {
                var seenIndex = seen.length;
                while (seenIndex--) {
                  if (seen[seenIndex] === computed) {
                    continue outer;
                  }
                }
                if (iteratee2) {
                  seen.push(computed);
                }
                result2.push(value);
              } else if (!includes2(seen, computed, comparator)) {
                if (seen !== result2) {
                  seen.push(computed);
                }
                result2.push(value);
              }
            }
          return result2;
        }
        function baseUnset(object, path) {
          path = castPath(path, object);
          object = parent(object, path);
          return object == null || delete object[toKey(last(path))];
        }
        function baseUpdate(object, path, updater, customizer) {
          return baseSet(object, path, updater(baseGet(object, path)), customizer);
        }
        function baseWhile(array, predicate, isDrop, fromRight) {
          var length = array.length, index = fromRight ? length : -1;
          while ((fromRight ? index-- : ++index < length) && predicate(array[index], index, array)) {
          }
          return isDrop ? baseSlice(array, fromRight ? 0 : index, fromRight ? index + 1 : length) : baseSlice(array, fromRight ? index + 1 : 0, fromRight ? length : index);
        }
        function baseWrapperValue(value, actions) {
          var result2 = value;
          if (result2 instanceof LazyWrapper) {
            result2 = result2.value();
          }
          return arrayReduce(actions, function(result3, action) {
            return action.func.apply(action.thisArg, arrayPush([result3], action.args));
          }, result2);
        }
        function baseXor(arrays, iteratee2, comparator) {
          var length = arrays.length;
          if (length < 2) {
            return length ? baseUniq(arrays[0]) : [];
          }
          var index = -1, result2 = Array2(length);
          while (++index < length) {
            var array = arrays[index], othIndex = -1;
            while (++othIndex < length) {
              if (othIndex != index) {
                result2[index] = baseDifference(result2[index] || array, arrays[othIndex], iteratee2, comparator);
              }
            }
          }
          return baseUniq(baseFlatten(result2, 1), iteratee2, comparator);
        }
        function baseZipObject(props, values2, assignFunc) {
          var index = -1, length = props.length, valsLength = values2.length, result2 = {};
          while (++index < length) {
            var value = index < valsLength ? values2[index] : undefined2;
            assignFunc(result2, props[index], value);
          }
          return result2;
        }
        function castArrayLikeObject(value) {
          return isArrayLikeObject(value) ? value : [];
        }
        function castFunction(value) {
          return typeof value == "function" ? value : identity;
        }
        function castPath(value, object) {
          if (isArray(value)) {
            return value;
          }
          return isKey(value, object) ? [value] : stringToPath(toString(value));
        }
        var castRest = baseRest;
        function castSlice(array, start, end) {
          var length = array.length;
          end = end === undefined2 ? length : end;
          return !start && end >= length ? array : baseSlice(array, start, end);
        }
        var clearTimeout = ctxClearTimeout || function(id) {
          return root.clearTimeout(id);
        };
        function cloneBuffer(buffer, isDeep) {
          if (isDeep) {
            return buffer.slice();
          }
          var length = buffer.length, result2 = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
          buffer.copy(result2);
          return result2;
        }
        function cloneArrayBuffer(arrayBuffer) {
          var result2 = new arrayBuffer.constructor(arrayBuffer.byteLength);
          new Uint8Array2(result2).set(new Uint8Array2(arrayBuffer));
          return result2;
        }
        function cloneDataView(dataView, isDeep) {
          var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
          return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
        }
        function cloneRegExp(regexp) {
          var result2 = new regexp.constructor(regexp.source, reFlags.exec(regexp));
          result2.lastIndex = regexp.lastIndex;
          return result2;
        }
        function cloneSymbol(symbol) {
          return symbolValueOf ? Object2(symbolValueOf.call(symbol)) : {};
        }
        function cloneTypedArray(typedArray, isDeep) {
          var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
          return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
        }
        function compareAscending(value, other) {
          if (value !== other) {
            var valIsDefined = value !== undefined2, valIsNull = value === null, valIsReflexive = value === value, valIsSymbol = isSymbol(value);
            var othIsDefined = other !== undefined2, othIsNull = other === null, othIsReflexive = other === other, othIsSymbol = isSymbol(other);
            if (!othIsNull && !othIsSymbol && !valIsSymbol && value > other || valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol || valIsNull && othIsDefined && othIsReflexive || !valIsDefined && othIsReflexive || !valIsReflexive) {
              return 1;
            }
            if (!valIsNull && !valIsSymbol && !othIsSymbol && value < other || othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol || othIsNull && valIsDefined && valIsReflexive || !othIsDefined && valIsReflexive || !othIsReflexive) {
              return -1;
            }
          }
          return 0;
        }
        function compareMultiple(object, other, orders) {
          var index = -1, objCriteria = object.criteria, othCriteria = other.criteria, length = objCriteria.length, ordersLength = orders.length;
          while (++index < length) {
            var result2 = compareAscending(objCriteria[index], othCriteria[index]);
            if (result2) {
              if (index >= ordersLength) {
                return result2;
              }
              var order = orders[index];
              return result2 * (order == "desc" ? -1 : 1);
            }
          }
          return object.index - other.index;
        }
        function composeArgs(args, partials, holders, isCurried) {
          var argsIndex = -1, argsLength = args.length, holdersLength = holders.length, leftIndex = -1, leftLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result2 = Array2(leftLength + rangeLength), isUncurried = !isCurried;
          while (++leftIndex < leftLength) {
            result2[leftIndex] = partials[leftIndex];
          }
          while (++argsIndex < holdersLength) {
            if (isUncurried || argsIndex < argsLength) {
              result2[holders[argsIndex]] = args[argsIndex];
            }
          }
          while (rangeLength--) {
            result2[leftIndex++] = args[argsIndex++];
          }
          return result2;
        }
        function composeArgsRight(args, partials, holders, isCurried) {
          var argsIndex = -1, argsLength = args.length, holdersIndex = -1, holdersLength = holders.length, rightIndex = -1, rightLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result2 = Array2(rangeLength + rightLength), isUncurried = !isCurried;
          while (++argsIndex < rangeLength) {
            result2[argsIndex] = args[argsIndex];
          }
          var offset = argsIndex;
          while (++rightIndex < rightLength) {
            result2[offset + rightIndex] = partials[rightIndex];
          }
          while (++holdersIndex < holdersLength) {
            if (isUncurried || argsIndex < argsLength) {
              result2[offset + holders[holdersIndex]] = args[argsIndex++];
            }
          }
          return result2;
        }
        function copyArray(source, array) {
          var index = -1, length = source.length;
          array || (array = Array2(length));
          while (++index < length) {
            array[index] = source[index];
          }
          return array;
        }
        function copyObject(source, props, object, customizer) {
          var isNew = !object;
          object || (object = {});
          var index = -1, length = props.length;
          while (++index < length) {
            var key = props[index];
            var newValue = customizer ? customizer(object[key], source[key], key, object, source) : undefined2;
            if (newValue === undefined2) {
              newValue = source[key];
            }
            if (isNew) {
              baseAssignValue(object, key, newValue);
            } else {
              assignValue(object, key, newValue);
            }
          }
          return object;
        }
        function copySymbols(source, object) {
          return copyObject(source, getSymbols(source), object);
        }
        function copySymbolsIn(source, object) {
          return copyObject(source, getSymbolsIn(source), object);
        }
        function createAggregator(setter, initializer) {
          return function(collection, iteratee2) {
            var func = isArray(collection) ? arrayAggregator : baseAggregator, accumulator = initializer ? initializer() : {};
            return func(collection, setter, getIteratee(iteratee2, 2), accumulator);
          };
        }
        function createAssigner(assigner) {
          return baseRest(function(object, sources) {
            var index = -1, length = sources.length, customizer = length > 1 ? sources[length - 1] : undefined2, guard = length > 2 ? sources[2] : undefined2;
            customizer = assigner.length > 3 && typeof customizer == "function" ? (length--, customizer) : undefined2;
            if (guard && isIterateeCall(sources[0], sources[1], guard)) {
              customizer = length < 3 ? undefined2 : customizer;
              length = 1;
            }
            object = Object2(object);
            while (++index < length) {
              var source = sources[index];
              if (source) {
                assigner(object, source, index, customizer);
              }
            }
            return object;
          });
        }
        function createBaseEach(eachFunc, fromRight) {
          return function(collection, iteratee2) {
            if (collection == null) {
              return collection;
            }
            if (!isArrayLike(collection)) {
              return eachFunc(collection, iteratee2);
            }
            var length = collection.length, index = fromRight ? length : -1, iterable = Object2(collection);
            while (fromRight ? index-- : ++index < length) {
              if (iteratee2(iterable[index], index, iterable) === false) {
                break;
              }
            }
            return collection;
          };
        }
        function createBaseFor(fromRight) {
          return function(object, iteratee2, keysFunc) {
            var index = -1, iterable = Object2(object), props = keysFunc(object), length = props.length;
            while (length--) {
              var key = props[fromRight ? length : ++index];
              if (iteratee2(iterable[key], key, iterable) === false) {
                break;
              }
            }
            return object;
          };
        }
        function createBind(func, bitmask, thisArg) {
          var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
          function wrapper() {
            var fn = this && this !== root && this instanceof wrapper ? Ctor : func;
            return fn.apply(isBind ? thisArg : this, arguments);
          }
          return wrapper;
        }
        function createCaseFirst(methodName) {
          return function(string) {
            string = toString(string);
            var strSymbols = hasUnicode(string) ? stringToArray(string) : undefined2;
            var chr = strSymbols ? strSymbols[0] : string.charAt(0);
            var trailing = strSymbols ? castSlice(strSymbols, 1).join("") : string.slice(1);
            return chr[methodName]() + trailing;
          };
        }
        function createCompounder(callback) {
          return function(string) {
            return arrayReduce(words(deburr(string).replace(reApos, "")), callback, "");
          };
        }
        function createCtor(Ctor) {
          return function() {
            var args = arguments;
            switch (args.length) {
              case 0:
                return new Ctor();
              case 1:
                return new Ctor(args[0]);
              case 2:
                return new Ctor(args[0], args[1]);
              case 3:
                return new Ctor(args[0], args[1], args[2]);
              case 4:
                return new Ctor(args[0], args[1], args[2], args[3]);
              case 5:
                return new Ctor(args[0], args[1], args[2], args[3], args[4]);
              case 6:
                return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
              case 7:
                return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
            }
            var thisBinding = baseCreate(Ctor.prototype), result2 = Ctor.apply(thisBinding, args);
            return isObject(result2) ? result2 : thisBinding;
          };
        }
        function createCurry(func, bitmask, arity) {
          var Ctor = createCtor(func);
          function wrapper() {
            var length = arguments.length, args = Array2(length), index = length, placeholder = getHolder(wrapper);
            while (index--) {
              args[index] = arguments[index];
            }
            var holders = length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder ? [] : replaceHolders(args, placeholder);
            length -= holders.length;
            if (length < arity) {
              return createRecurry(func, bitmask, createHybrid, wrapper.placeholder, undefined2, args, holders, undefined2, undefined2, arity - length);
            }
            var fn = this && this !== root && this instanceof wrapper ? Ctor : func;
            return apply(fn, this, args);
          }
          return wrapper;
        }
        function createFind(findIndexFunc) {
          return function(collection, predicate, fromIndex) {
            var iterable = Object2(collection);
            if (!isArrayLike(collection)) {
              var iteratee2 = getIteratee(predicate, 3);
              collection = keys(collection);
              predicate = function(key) {
                return iteratee2(iterable[key], key, iterable);
              };
            }
            var index = findIndexFunc(collection, predicate, fromIndex);
            return index > -1 ? iterable[iteratee2 ? collection[index] : index] : undefined2;
          };
        }
        function createFlow(fromRight) {
          return flatRest(function(funcs) {
            var length = funcs.length, index = length, prereq = LodashWrapper.prototype.thru;
            if (fromRight) {
              funcs.reverse();
            }
            while (index--) {
              var func = funcs[index];
              if (typeof func != "function") {
                throw new TypeError2(FUNC_ERROR_TEXT);
              }
              if (prereq && !wrapper && getFuncName(func) == "wrapper") {
                var wrapper = new LodashWrapper([], true);
              }
            }
            index = wrapper ? index : length;
            while (++index < length) {
              func = funcs[index];
              var funcName = getFuncName(func), data = funcName == "wrapper" ? getData(func) : undefined2;
              if (data && isLaziable(data[0]) && data[1] == (WRAP_ARY_FLAG | WRAP_CURRY_FLAG | WRAP_PARTIAL_FLAG | WRAP_REARG_FLAG) && !data[4].length && data[9] == 1) {
                wrapper = wrapper[getFuncName(data[0])].apply(wrapper, data[3]);
              } else {
                wrapper = func.length == 1 && isLaziable(func) ? wrapper[funcName]() : wrapper.thru(func);
              }
            }
            return function() {
              var args = arguments, value = args[0];
              if (wrapper && args.length == 1 && isArray(value)) {
                return wrapper.plant(value).value();
              }
              var index2 = 0, result2 = length ? funcs[index2].apply(this, args) : value;
              while (++index2 < length) {
                result2 = funcs[index2].call(this, result2);
              }
              return result2;
            };
          });
        }
        function createHybrid(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary2, arity) {
          var isAry = bitmask & WRAP_ARY_FLAG, isBind = bitmask & WRAP_BIND_FLAG, isBindKey = bitmask & WRAP_BIND_KEY_FLAG, isCurried = bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG), isFlip = bitmask & WRAP_FLIP_FLAG, Ctor = isBindKey ? undefined2 : createCtor(func);
          function wrapper() {
            var length = arguments.length, args = Array2(length), index = length;
            while (index--) {
              args[index] = arguments[index];
            }
            if (isCurried) {
              var placeholder = getHolder(wrapper), holdersCount = countHolders(args, placeholder);
            }
            if (partials) {
              args = composeArgs(args, partials, holders, isCurried);
            }
            if (partialsRight) {
              args = composeArgsRight(args, partialsRight, holdersRight, isCurried);
            }
            length -= holdersCount;
            if (isCurried && length < arity) {
              var newHolders = replaceHolders(args, placeholder);
              return createRecurry(func, bitmask, createHybrid, wrapper.placeholder, thisArg, args, newHolders, argPos, ary2, arity - length);
            }
            var thisBinding = isBind ? thisArg : this, fn = isBindKey ? thisBinding[func] : func;
            length = args.length;
            if (argPos) {
              args = reorder(args, argPos);
            } else if (isFlip && length > 1) {
              args.reverse();
            }
            if (isAry && ary2 < length) {
              args.length = ary2;
            }
            if (this && this !== root && this instanceof wrapper) {
              fn = Ctor || createCtor(fn);
            }
            return fn.apply(thisBinding, args);
          }
          return wrapper;
        }
        function createInverter(setter, toIteratee) {
          return function(object, iteratee2) {
            return baseInverter(object, setter, toIteratee(iteratee2), {});
          };
        }
        function createMathOperation(operator, defaultValue) {
          return function(value, other) {
            var result2;
            if (value === undefined2 && other === undefined2) {
              return defaultValue;
            }
            if (value !== undefined2) {
              result2 = value;
            }
            if (other !== undefined2) {
              if (result2 === undefined2) {
                return other;
              }
              if (typeof value == "string" || typeof other == "string") {
                value = baseToString(value);
                other = baseToString(other);
              } else {
                value = baseToNumber(value);
                other = baseToNumber(other);
              }
              result2 = operator(value, other);
            }
            return result2;
          };
        }
        function createOver(arrayFunc) {
          return flatRest(function(iteratees) {
            iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
            return baseRest(function(args) {
              var thisArg = this;
              return arrayFunc(iteratees, function(iteratee2) {
                return apply(iteratee2, thisArg, args);
              });
            });
          });
        }
        function createPadding(length, chars) {
          chars = chars === undefined2 ? " " : baseToString(chars);
          var charsLength = chars.length;
          if (charsLength < 2) {
            return charsLength ? baseRepeat(chars, length) : chars;
          }
          var result2 = baseRepeat(chars, nativeCeil(length / stringSize(chars)));
          return hasUnicode(chars) ? castSlice(stringToArray(result2), 0, length).join("") : result2.slice(0, length);
        }
        function createPartial(func, bitmask, thisArg, partials) {
          var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
          function wrapper() {
            var argsIndex = -1, argsLength = arguments.length, leftIndex = -1, leftLength = partials.length, args = Array2(leftLength + argsLength), fn = this && this !== root && this instanceof wrapper ? Ctor : func;
            while (++leftIndex < leftLength) {
              args[leftIndex] = partials[leftIndex];
            }
            while (argsLength--) {
              args[leftIndex++] = arguments[++argsIndex];
            }
            return apply(fn, isBind ? thisArg : this, args);
          }
          return wrapper;
        }
        function createRange(fromRight) {
          return function(start, end, step) {
            if (step && typeof step != "number" && isIterateeCall(start, end, step)) {
              end = step = undefined2;
            }
            start = toFinite(start);
            if (end === undefined2) {
              end = start;
              start = 0;
            } else {
              end = toFinite(end);
            }
            step = step === undefined2 ? start < end ? 1 : -1 : toFinite(step);
            return baseRange(start, end, step, fromRight);
          };
        }
        function createRelationalOperation(operator) {
          return function(value, other) {
            if (!(typeof value == "string" && typeof other == "string")) {
              value = toNumber(value);
              other = toNumber(other);
            }
            return operator(value, other);
          };
        }
        function createRecurry(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary2, arity) {
          var isCurry = bitmask & WRAP_CURRY_FLAG, newHolders = isCurry ? holders : undefined2, newHoldersRight = isCurry ? undefined2 : holders, newPartials = isCurry ? partials : undefined2, newPartialsRight = isCurry ? undefined2 : partials;
          bitmask |= isCurry ? WRAP_PARTIAL_FLAG : WRAP_PARTIAL_RIGHT_FLAG;
          bitmask &= ~(isCurry ? WRAP_PARTIAL_RIGHT_FLAG : WRAP_PARTIAL_FLAG);
          if (!(bitmask & WRAP_CURRY_BOUND_FLAG)) {
            bitmask &= ~(WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG);
          }
          var newData = [
            func,
            bitmask,
            thisArg,
            newPartials,
            newHolders,
            newPartialsRight,
            newHoldersRight,
            argPos,
            ary2,
            arity
          ];
          var result2 = wrapFunc.apply(undefined2, newData);
          if (isLaziable(func)) {
            setData(result2, newData);
          }
          result2.placeholder = placeholder;
          return setWrapToString(result2, func, bitmask);
        }
        function createRound(methodName) {
          var func = Math2[methodName];
          return function(number, precision) {
            number = toNumber(number);
            precision = precision == null ? 0 : nativeMin(toInteger(precision), 292);
            if (precision && nativeIsFinite(number)) {
              var pair2 = (toString(number) + "e").split("e"), value = func(pair2[0] + "e" + (+pair2[1] + precision));
              pair2 = (toString(value) + "e").split("e");
              return +(pair2[0] + "e" + (+pair2[1] - precision));
            }
            return func(number);
          };
        }
        var createSet = !(Set && 1 / setToArray(new Set([, -0]))[1] == INFINITY) ? noop : function(values2) {
          return new Set(values2);
        };
        function createToPairs(keysFunc) {
          return function(object) {
            var tag = getTag(object);
            if (tag == mapTag) {
              return mapToArray(object);
            }
            if (tag == setTag) {
              return setToPairs(object);
            }
            return baseToPairs(object, keysFunc(object));
          };
        }
        function createWrap(func, bitmask, thisArg, partials, holders, argPos, ary2, arity) {
          var isBindKey = bitmask & WRAP_BIND_KEY_FLAG;
          if (!isBindKey && typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          var length = partials ? partials.length : 0;
          if (!length) {
            bitmask &= ~(WRAP_PARTIAL_FLAG | WRAP_PARTIAL_RIGHT_FLAG);
            partials = holders = undefined2;
          }
          ary2 = ary2 === undefined2 ? ary2 : nativeMax(toInteger(ary2), 0);
          arity = arity === undefined2 ? arity : toInteger(arity);
          length -= holders ? holders.length : 0;
          if (bitmask & WRAP_PARTIAL_RIGHT_FLAG) {
            var partialsRight = partials, holdersRight = holders;
            partials = holders = undefined2;
          }
          var data = isBindKey ? undefined2 : getData(func);
          var newData = [
            func,
            bitmask,
            thisArg,
            partials,
            holders,
            partialsRight,
            holdersRight,
            argPos,
            ary2,
            arity
          ];
          if (data) {
            mergeData(newData, data);
          }
          func = newData[0];
          bitmask = newData[1];
          thisArg = newData[2];
          partials = newData[3];
          holders = newData[4];
          arity = newData[9] = newData[9] === undefined2 ? isBindKey ? 0 : func.length : nativeMax(newData[9] - length, 0);
          if (!arity && bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG)) {
            bitmask &= ~(WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG);
          }
          if (!bitmask || bitmask == WRAP_BIND_FLAG) {
            var result2 = createBind(func, bitmask, thisArg);
          } else if (bitmask == WRAP_CURRY_FLAG || bitmask == WRAP_CURRY_RIGHT_FLAG) {
            result2 = createCurry(func, bitmask, arity);
          } else if ((bitmask == WRAP_PARTIAL_FLAG || bitmask == (WRAP_BIND_FLAG | WRAP_PARTIAL_FLAG)) && !holders.length) {
            result2 = createPartial(func, bitmask, thisArg, partials);
          } else {
            result2 = createHybrid.apply(undefined2, newData);
          }
          var setter = data ? baseSetData : setData;
          return setWrapToString(setter(result2, newData), func, bitmask);
        }
        function customDefaultsAssignIn(objValue, srcValue, key, object) {
          if (objValue === undefined2 || eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key)) {
            return srcValue;
          }
          return objValue;
        }
        function customDefaultsMerge(objValue, srcValue, key, object, source, stack) {
          if (isObject(objValue) && isObject(srcValue)) {
            stack.set(srcValue, objValue);
            baseMerge(objValue, srcValue, undefined2, customDefaultsMerge, stack);
            stack["delete"](srcValue);
          }
          return objValue;
        }
        function customOmitClone(value) {
          return isPlainObject(value) ? undefined2 : value;
        }
        function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
          var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
          if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
            return false;
          }
          var arrStacked = stack.get(array);
          var othStacked = stack.get(other);
          if (arrStacked && othStacked) {
            return arrStacked == other && othStacked == array;
          }
          var index = -1, result2 = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : undefined2;
          stack.set(array, other);
          stack.set(other, array);
          while (++index < arrLength) {
            var arrValue = array[index], othValue = other[index];
            if (customizer) {
              var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
            }
            if (compared !== undefined2) {
              if (compared) {
                continue;
              }
              result2 = false;
              break;
            }
            if (seen) {
              if (!arraySome(other, function(othValue2, othIndex) {
                if (!cacheHas(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer, stack))) {
                  return seen.push(othIndex);
                }
              })) {
                result2 = false;
                break;
              }
            } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
              result2 = false;
              break;
            }
          }
          stack["delete"](array);
          stack["delete"](other);
          return result2;
        }
        function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
          switch (tag) {
            case dataViewTag:
              if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
                return false;
              }
              object = object.buffer;
              other = other.buffer;
            case arrayBufferTag:
              if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array2(object), new Uint8Array2(other))) {
                return false;
              }
              return true;
            case boolTag:
            case dateTag:
            case numberTag:
              return eq(+object, +other);
            case errorTag:
              return object.name == other.name && object.message == other.message;
            case regexpTag:
            case stringTag:
              return object == other + "";
            case mapTag:
              var convert = mapToArray;
            case setTag:
              var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
              convert || (convert = setToArray);
              if (object.size != other.size && !isPartial) {
                return false;
              }
              var stacked = stack.get(object);
              if (stacked) {
                return stacked == other;
              }
              bitmask |= COMPARE_UNORDERED_FLAG;
              stack.set(object, other);
              var result2 = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
              stack["delete"](object);
              return result2;
            case symbolTag:
              if (symbolValueOf) {
                return symbolValueOf.call(object) == symbolValueOf.call(other);
              }
          }
          return false;
        }
        function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
          var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length, othProps = getAllKeys(other), othLength = othProps.length;
          if (objLength != othLength && !isPartial) {
            return false;
          }
          var index = objLength;
          while (index--) {
            var key = objProps[index];
            if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
              return false;
            }
          }
          var objStacked = stack.get(object);
          var othStacked = stack.get(other);
          if (objStacked && othStacked) {
            return objStacked == other && othStacked == object;
          }
          var result2 = true;
          stack.set(object, other);
          stack.set(other, object);
          var skipCtor = isPartial;
          while (++index < objLength) {
            key = objProps[index];
            var objValue = object[key], othValue = other[key];
            if (customizer) {
              var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
            }
            if (!(compared === undefined2 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
              result2 = false;
              break;
            }
            skipCtor || (skipCtor = key == "constructor");
          }
          if (result2 && !skipCtor) {
            var objCtor = object.constructor, othCtor = other.constructor;
            if (objCtor != othCtor && ("constructor" in object && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
              result2 = false;
            }
          }
          stack["delete"](object);
          stack["delete"](other);
          return result2;
        }
        function flatRest(func) {
          return setToString(overRest(func, undefined2, flatten), func + "");
        }
        function getAllKeys(object) {
          return baseGetAllKeys(object, keys, getSymbols);
        }
        function getAllKeysIn(object) {
          return baseGetAllKeys(object, keysIn, getSymbolsIn);
        }
        var getData = !metaMap ? noop : function(func) {
          return metaMap.get(func);
        };
        function getFuncName(func) {
          var result2 = func.name + "", array = realNames[result2], length = hasOwnProperty.call(realNames, result2) ? array.length : 0;
          while (length--) {
            var data = array[length], otherFunc = data.func;
            if (otherFunc == null || otherFunc == func) {
              return data.name;
            }
          }
          return result2;
        }
        function getHolder(func) {
          var object = hasOwnProperty.call(lodash, "placeholder") ? lodash : func;
          return object.placeholder;
        }
        function getIteratee() {
          var result2 = lodash.iteratee || iteratee;
          result2 = result2 === iteratee ? baseIteratee : result2;
          return arguments.length ? result2(arguments[0], arguments[1]) : result2;
        }
        function getMapData(map2, key) {
          var data = map2.__data__;
          return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
        }
        function getMatchData(object) {
          var result2 = keys(object), length = result2.length;
          while (length--) {
            var key = result2[length], value = object[key];
            result2[length] = [key, value, isStrictComparable(value)];
          }
          return result2;
        }
        function getNative(object, key) {
          var value = getValue(object, key);
          return baseIsNative(value) ? value : undefined2;
        }
        function getRawTag(value) {
          var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
          try {
            value[symToStringTag] = undefined2;
            var unmasked = true;
          } catch (e) {
          }
          var result2 = nativeObjectToString.call(value);
          if (unmasked) {
            if (isOwn) {
              value[symToStringTag] = tag;
            } else {
              delete value[symToStringTag];
            }
          }
          return result2;
        }
        var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
          if (object == null) {
            return [];
          }
          object = Object2(object);
          return arrayFilter(nativeGetSymbols(object), function(symbol) {
            return propertyIsEnumerable.call(object, symbol);
          });
        };
        var getSymbolsIn = !nativeGetSymbols ? stubArray : function(object) {
          var result2 = [];
          while (object) {
            arrayPush(result2, getSymbols(object));
            object = getPrototype(object);
          }
          return result2;
        };
        var getTag = baseGetTag;
        if (DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag || Map && getTag(new Map()) != mapTag || Promise2 && getTag(Promise2.resolve()) != promiseTag || Set && getTag(new Set()) != setTag || WeakMap2 && getTag(new WeakMap2()) != weakMapTag) {
          getTag = function(value) {
            var result2 = baseGetTag(value), Ctor = result2 == objectTag ? value.constructor : undefined2, ctorString = Ctor ? toSource(Ctor) : "";
            if (ctorString) {
              switch (ctorString) {
                case dataViewCtorString:
                  return dataViewTag;
                case mapCtorString:
                  return mapTag;
                case promiseCtorString:
                  return promiseTag;
                case setCtorString:
                  return setTag;
                case weakMapCtorString:
                  return weakMapTag;
              }
            }
            return result2;
          };
        }
        function getView(start, end, transforms) {
          var index = -1, length = transforms.length;
          while (++index < length) {
            var data = transforms[index], size2 = data.size;
            switch (data.type) {
              case "drop":
                start += size2;
                break;
              case "dropRight":
                end -= size2;
                break;
              case "take":
                end = nativeMin(end, start + size2);
                break;
              case "takeRight":
                start = nativeMax(start, end - size2);
                break;
            }
          }
          return { "start": start, "end": end };
        }
        function getWrapDetails(source) {
          var match = source.match(reWrapDetails);
          return match ? match[1].split(reSplitDetails) : [];
        }
        function hasPath(object, path, hasFunc) {
          path = castPath(path, object);
          var index = -1, length = path.length, result2 = false;
          while (++index < length) {
            var key = toKey(path[index]);
            if (!(result2 = object != null && hasFunc(object, key))) {
              break;
            }
            object = object[key];
          }
          if (result2 || ++index != length) {
            return result2;
          }
          length = object == null ? 0 : object.length;
          return !!length && isLength(length) && isIndex(key, length) && (isArray(object) || isArguments(object));
        }
        function initCloneArray(array) {
          var length = array.length, result2 = new array.constructor(length);
          if (length && typeof array[0] == "string" && hasOwnProperty.call(array, "index")) {
            result2.index = array.index;
            result2.input = array.input;
          }
          return result2;
        }
        function initCloneObject(object) {
          return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {};
        }
        function initCloneByTag(object, tag, isDeep) {
          var Ctor = object.constructor;
          switch (tag) {
            case arrayBufferTag:
              return cloneArrayBuffer(object);
            case boolTag:
            case dateTag:
              return new Ctor(+object);
            case dataViewTag:
              return cloneDataView(object, isDeep);
            case float32Tag:
            case float64Tag:
            case int8Tag:
            case int16Tag:
            case int32Tag:
            case uint8Tag:
            case uint8ClampedTag:
            case uint16Tag:
            case uint32Tag:
              return cloneTypedArray(object, isDeep);
            case mapTag:
              return new Ctor();
            case numberTag:
            case stringTag:
              return new Ctor(object);
            case regexpTag:
              return cloneRegExp(object);
            case setTag:
              return new Ctor();
            case symbolTag:
              return cloneSymbol(object);
          }
        }
        function insertWrapDetails(source, details) {
          var length = details.length;
          if (!length) {
            return source;
          }
          var lastIndex = length - 1;
          details[lastIndex] = (length > 1 ? "& " : "") + details[lastIndex];
          details = details.join(length > 2 ? ", " : " ");
          return source.replace(reWrapComment, "{\n/* [wrapped with " + details + "] */\n");
        }
        function isFlattenable(value) {
          return isArray(value) || isArguments(value) || !!(spreadableSymbol && value && value[spreadableSymbol]);
        }
        function isIndex(value, length) {
          var type = typeof value;
          length = length == null ? MAX_SAFE_INTEGER : length;
          return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
        }
        function isIterateeCall(value, index, object) {
          if (!isObject(object)) {
            return false;
          }
          var type = typeof index;
          if (type == "number" ? isArrayLike(object) && isIndex(index, object.length) : type == "string" && index in object) {
            return eq(object[index], value);
          }
          return false;
        }
        function isKey(value, object) {
          if (isArray(value)) {
            return false;
          }
          var type = typeof value;
          if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) {
            return true;
          }
          return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object2(object);
        }
        function isKeyable(value) {
          var type = typeof value;
          return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
        }
        function isLaziable(func) {
          var funcName = getFuncName(func), other = lodash[funcName];
          if (typeof other != "function" || !(funcName in LazyWrapper.prototype)) {
            return false;
          }
          if (func === other) {
            return true;
          }
          var data = getData(other);
          return !!data && func === data[0];
        }
        function isMasked(func) {
          return !!maskSrcKey && maskSrcKey in func;
        }
        var isMaskable = coreJsData ? isFunction : stubFalse;
        function isPrototype(value) {
          var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
          return value === proto;
        }
        function isStrictComparable(value) {
          return value === value && !isObject(value);
        }
        function matchesStrictComparable(key, srcValue) {
          return function(object) {
            if (object == null) {
              return false;
            }
            return object[key] === srcValue && (srcValue !== undefined2 || key in Object2(object));
          };
        }
        function memoizeCapped(func) {
          var result2 = memoize(func, function(key) {
            if (cache.size === MAX_MEMOIZE_SIZE) {
              cache.clear();
            }
            return key;
          });
          var cache = result2.cache;
          return result2;
        }
        function mergeData(data, source) {
          var bitmask = data[1], srcBitmask = source[1], newBitmask = bitmask | srcBitmask, isCommon = newBitmask < (WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG | WRAP_ARY_FLAG);
          var isCombo = srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_CURRY_FLAG || srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_REARG_FLAG && data[7].length <= source[8] || srcBitmask == (WRAP_ARY_FLAG | WRAP_REARG_FLAG) && source[7].length <= source[8] && bitmask == WRAP_CURRY_FLAG;
          if (!(isCommon || isCombo)) {
            return data;
          }
          if (srcBitmask & WRAP_BIND_FLAG) {
            data[2] = source[2];
            newBitmask |= bitmask & WRAP_BIND_FLAG ? 0 : WRAP_CURRY_BOUND_FLAG;
          }
          var value = source[3];
          if (value) {
            var partials = data[3];
            data[3] = partials ? composeArgs(partials, value, source[4]) : value;
            data[4] = partials ? replaceHolders(data[3], PLACEHOLDER) : source[4];
          }
          value = source[5];
          if (value) {
            partials = data[5];
            data[5] = partials ? composeArgsRight(partials, value, source[6]) : value;
            data[6] = partials ? replaceHolders(data[5], PLACEHOLDER) : source[6];
          }
          value = source[7];
          if (value) {
            data[7] = value;
          }
          if (srcBitmask & WRAP_ARY_FLAG) {
            data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
          }
          if (data[9] == null) {
            data[9] = source[9];
          }
          data[0] = source[0];
          data[1] = newBitmask;
          return data;
        }
        function nativeKeysIn(object) {
          var result2 = [];
          if (object != null) {
            for (var key in Object2(object)) {
              result2.push(key);
            }
          }
          return result2;
        }
        function objectToString(value) {
          return nativeObjectToString.call(value);
        }
        function overRest(func, start, transform2) {
          start = nativeMax(start === undefined2 ? func.length - 1 : start, 0);
          return function() {
            var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array2(length);
            while (++index < length) {
              array[index] = args[start + index];
            }
            index = -1;
            var otherArgs = Array2(start + 1);
            while (++index < start) {
              otherArgs[index] = args[index];
            }
            otherArgs[start] = transform2(array);
            return apply(func, this, otherArgs);
          };
        }
        function parent(object, path) {
          return path.length < 2 ? object : baseGet(object, baseSlice(path, 0, -1));
        }
        function reorder(array, indexes) {
          var arrLength = array.length, length = nativeMin(indexes.length, arrLength), oldArray = copyArray(array);
          while (length--) {
            var index = indexes[length];
            array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined2;
          }
          return array;
        }
        function safeGet(object, key) {
          if (key === "constructor" && typeof object[key] === "function") {
            return;
          }
          if (key == "__proto__") {
            return;
          }
          return object[key];
        }
        var setData = shortOut(baseSetData);
        var setTimeout = ctxSetTimeout || function(func, wait) {
          return root.setTimeout(func, wait);
        };
        var setToString = shortOut(baseSetToString);
        function setWrapToString(wrapper, reference, bitmask) {
          var source = reference + "";
          return setToString(wrapper, insertWrapDetails(source, updateWrapDetails(getWrapDetails(source), bitmask)));
        }
        function shortOut(func) {
          var count = 0, lastCalled = 0;
          return function() {
            var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
            lastCalled = stamp;
            if (remaining > 0) {
              if (++count >= HOT_COUNT) {
                return arguments[0];
              }
            } else {
              count = 0;
            }
            return func.apply(undefined2, arguments);
          };
        }
        function shuffleSelf(array, size2) {
          var index = -1, length = array.length, lastIndex = length - 1;
          size2 = size2 === undefined2 ? length : size2;
          while (++index < size2) {
            var rand = baseRandom(index, lastIndex), value = array[rand];
            array[rand] = array[index];
            array[index] = value;
          }
          array.length = size2;
          return array;
        }
        var stringToPath = memoizeCapped(function(string) {
          var result2 = [];
          if (string.charCodeAt(0) === 46) {
            result2.push("");
          }
          string.replace(rePropName, function(match, number, quote, subString) {
            result2.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
          });
          return result2;
        });
        function toKey(value) {
          if (typeof value == "string" || isSymbol(value)) {
            return value;
          }
          var result2 = value + "";
          return result2 == "0" && 1 / value == -INFINITY ? "-0" : result2;
        }
        function toSource(func) {
          if (func != null) {
            try {
              return funcToString.call(func);
            } catch (e) {
            }
            try {
              return func + "";
            } catch (e) {
            }
          }
          return "";
        }
        function updateWrapDetails(details, bitmask) {
          arrayEach(wrapFlags, function(pair2) {
            var value = "_." + pair2[0];
            if (bitmask & pair2[1] && !arrayIncludes(details, value)) {
              details.push(value);
            }
          });
          return details.sort();
        }
        function wrapperClone(wrapper) {
          if (wrapper instanceof LazyWrapper) {
            return wrapper.clone();
          }
          var result2 = new LodashWrapper(wrapper.__wrapped__, wrapper.__chain__);
          result2.__actions__ = copyArray(wrapper.__actions__);
          result2.__index__ = wrapper.__index__;
          result2.__values__ = wrapper.__values__;
          return result2;
        }
        function chunk(array, size2, guard) {
          if (guard ? isIterateeCall(array, size2, guard) : size2 === undefined2) {
            size2 = 1;
          } else {
            size2 = nativeMax(toInteger(size2), 0);
          }
          var length = array == null ? 0 : array.length;
          if (!length || size2 < 1) {
            return [];
          }
          var index = 0, resIndex = 0, result2 = Array2(nativeCeil(length / size2));
          while (index < length) {
            result2[resIndex++] = baseSlice(array, index, index += size2);
          }
          return result2;
        }
        function compact(array) {
          var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result2 = [];
          while (++index < length) {
            var value = array[index];
            if (value) {
              result2[resIndex++] = value;
            }
          }
          return result2;
        }
        function concat() {
          var length = arguments.length;
          if (!length) {
            return [];
          }
          var args = Array2(length - 1), array = arguments[0], index = length;
          while (index--) {
            args[index - 1] = arguments[index];
          }
          return arrayPush(isArray(array) ? copyArray(array) : [array], baseFlatten(args, 1));
        }
        var difference = baseRest(function(array, values2) {
          return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values2, 1, isArrayLikeObject, true)) : [];
        });
        var differenceBy = baseRest(function(array, values2) {
          var iteratee2 = last(values2);
          if (isArrayLikeObject(iteratee2)) {
            iteratee2 = undefined2;
          }
          return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values2, 1, isArrayLikeObject, true), getIteratee(iteratee2, 2)) : [];
        });
        var differenceWith = baseRest(function(array, values2) {
          var comparator = last(values2);
          if (isArrayLikeObject(comparator)) {
            comparator = undefined2;
          }
          return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values2, 1, isArrayLikeObject, true), undefined2, comparator) : [];
        });
        function drop(array, n, guard) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          n = guard || n === undefined2 ? 1 : toInteger(n);
          return baseSlice(array, n < 0 ? 0 : n, length);
        }
        function dropRight(array, n, guard) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          n = guard || n === undefined2 ? 1 : toInteger(n);
          n = length - n;
          return baseSlice(array, 0, n < 0 ? 0 : n);
        }
        function dropRightWhile(array, predicate) {
          return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true, true) : [];
        }
        function dropWhile(array, predicate) {
          return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true) : [];
        }
        function fill(array, value, start, end) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          if (start && typeof start != "number" && isIterateeCall(array, value, start)) {
            start = 0;
            end = length;
          }
          return baseFill(array, value, start, end);
        }
        function findIndex(array, predicate, fromIndex) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return -1;
          }
          var index = fromIndex == null ? 0 : toInteger(fromIndex);
          if (index < 0) {
            index = nativeMax(length + index, 0);
          }
          return baseFindIndex(array, getIteratee(predicate, 3), index);
        }
        function findLastIndex(array, predicate, fromIndex) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return -1;
          }
          var index = length - 1;
          if (fromIndex !== undefined2) {
            index = toInteger(fromIndex);
            index = fromIndex < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
          }
          return baseFindIndex(array, getIteratee(predicate, 3), index, true);
        }
        function flatten(array) {
          var length = array == null ? 0 : array.length;
          return length ? baseFlatten(array, 1) : [];
        }
        function flattenDeep(array) {
          var length = array == null ? 0 : array.length;
          return length ? baseFlatten(array, INFINITY) : [];
        }
        function flattenDepth(array, depth) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          depth = depth === undefined2 ? 1 : toInteger(depth);
          return baseFlatten(array, depth);
        }
        function fromPairs(pairs) {
          var index = -1, length = pairs == null ? 0 : pairs.length, result2 = {};
          while (++index < length) {
            var pair2 = pairs[index];
            result2[pair2[0]] = pair2[1];
          }
          return result2;
        }
        function head(array) {
          return array && array.length ? array[0] : undefined2;
        }
        function indexOf(array, value, fromIndex) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return -1;
          }
          var index = fromIndex == null ? 0 : toInteger(fromIndex);
          if (index < 0) {
            index = nativeMax(length + index, 0);
          }
          return baseIndexOf(array, value, index);
        }
        function initial(array) {
          var length = array == null ? 0 : array.length;
          return length ? baseSlice(array, 0, -1) : [];
        }
        var intersection = baseRest(function(arrays) {
          var mapped = arrayMap(arrays, castArrayLikeObject);
          return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped) : [];
        });
        var intersectionBy = baseRest(function(arrays) {
          var iteratee2 = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
          if (iteratee2 === last(mapped)) {
            iteratee2 = undefined2;
          } else {
            mapped.pop();
          }
          return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, getIteratee(iteratee2, 2)) : [];
        });
        var intersectionWith = baseRest(function(arrays) {
          var comparator = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
          comparator = typeof comparator == "function" ? comparator : undefined2;
          if (comparator) {
            mapped.pop();
          }
          return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, undefined2, comparator) : [];
        });
        function join(array, separator) {
          return array == null ? "" : nativeJoin.call(array, separator);
        }
        function last(array) {
          var length = array == null ? 0 : array.length;
          return length ? array[length - 1] : undefined2;
        }
        function lastIndexOf(array, value, fromIndex) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return -1;
          }
          var index = length;
          if (fromIndex !== undefined2) {
            index = toInteger(fromIndex);
            index = index < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
          }
          return value === value ? strictLastIndexOf(array, value, index) : baseFindIndex(array, baseIsNaN, index, true);
        }
        function nth(array, n) {
          return array && array.length ? baseNth(array, toInteger(n)) : undefined2;
        }
        var pull = baseRest(pullAll);
        function pullAll(array, values2) {
          return array && array.length && values2 && values2.length ? basePullAll(array, values2) : array;
        }
        function pullAllBy(array, values2, iteratee2) {
          return array && array.length && values2 && values2.length ? basePullAll(array, values2, getIteratee(iteratee2, 2)) : array;
        }
        function pullAllWith(array, values2, comparator) {
          return array && array.length && values2 && values2.length ? basePullAll(array, values2, undefined2, comparator) : array;
        }
        var pullAt = flatRest(function(array, indexes) {
          var length = array == null ? 0 : array.length, result2 = baseAt(array, indexes);
          basePullAt(array, arrayMap(indexes, function(index) {
            return isIndex(index, length) ? +index : index;
          }).sort(compareAscending));
          return result2;
        });
        function remove(array, predicate) {
          var result2 = [];
          if (!(array && array.length)) {
            return result2;
          }
          var index = -1, indexes = [], length = array.length;
          predicate = getIteratee(predicate, 3);
          while (++index < length) {
            var value = array[index];
            if (predicate(value, index, array)) {
              result2.push(value);
              indexes.push(index);
            }
          }
          basePullAt(array, indexes);
          return result2;
        }
        function reverse(array) {
          return array == null ? array : nativeReverse.call(array);
        }
        function slice(array, start, end) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          if (end && typeof end != "number" && isIterateeCall(array, start, end)) {
            start = 0;
            end = length;
          } else {
            start = start == null ? 0 : toInteger(start);
            end = end === undefined2 ? length : toInteger(end);
          }
          return baseSlice(array, start, end);
        }
        function sortedIndex(array, value) {
          return baseSortedIndex(array, value);
        }
        function sortedIndexBy(array, value, iteratee2) {
          return baseSortedIndexBy(array, value, getIteratee(iteratee2, 2));
        }
        function sortedIndexOf(array, value) {
          var length = array == null ? 0 : array.length;
          if (length) {
            var index = baseSortedIndex(array, value);
            if (index < length && eq(array[index], value)) {
              return index;
            }
          }
          return -1;
        }
        function sortedLastIndex(array, value) {
          return baseSortedIndex(array, value, true);
        }
        function sortedLastIndexBy(array, value, iteratee2) {
          return baseSortedIndexBy(array, value, getIteratee(iteratee2, 2), true);
        }
        function sortedLastIndexOf(array, value) {
          var length = array == null ? 0 : array.length;
          if (length) {
            var index = baseSortedIndex(array, value, true) - 1;
            if (eq(array[index], value)) {
              return index;
            }
          }
          return -1;
        }
        function sortedUniq(array) {
          return array && array.length ? baseSortedUniq(array) : [];
        }
        function sortedUniqBy(array, iteratee2) {
          return array && array.length ? baseSortedUniq(array, getIteratee(iteratee2, 2)) : [];
        }
        function tail(array) {
          var length = array == null ? 0 : array.length;
          return length ? baseSlice(array, 1, length) : [];
        }
        function take(array, n, guard) {
          if (!(array && array.length)) {
            return [];
          }
          n = guard || n === undefined2 ? 1 : toInteger(n);
          return baseSlice(array, 0, n < 0 ? 0 : n);
        }
        function takeRight(array, n, guard) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          n = guard || n === undefined2 ? 1 : toInteger(n);
          n = length - n;
          return baseSlice(array, n < 0 ? 0 : n, length);
        }
        function takeRightWhile(array, predicate) {
          return array && array.length ? baseWhile(array, getIteratee(predicate, 3), false, true) : [];
        }
        function takeWhile(array, predicate) {
          return array && array.length ? baseWhile(array, getIteratee(predicate, 3)) : [];
        }
        var union = baseRest(function(arrays) {
          return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true));
        });
        var unionBy = baseRest(function(arrays) {
          var iteratee2 = last(arrays);
          if (isArrayLikeObject(iteratee2)) {
            iteratee2 = undefined2;
          }
          return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), getIteratee(iteratee2, 2));
        });
        var unionWith = baseRest(function(arrays) {
          var comparator = last(arrays);
          comparator = typeof comparator == "function" ? comparator : undefined2;
          return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), undefined2, comparator);
        });
        function uniq(array) {
          return array && array.length ? baseUniq(array) : [];
        }
        function uniqBy(array, iteratee2) {
          return array && array.length ? baseUniq(array, getIteratee(iteratee2, 2)) : [];
        }
        function uniqWith(array, comparator) {
          comparator = typeof comparator == "function" ? comparator : undefined2;
          return array && array.length ? baseUniq(array, undefined2, comparator) : [];
        }
        function unzip(array) {
          if (!(array && array.length)) {
            return [];
          }
          var length = 0;
          array = arrayFilter(array, function(group) {
            if (isArrayLikeObject(group)) {
              length = nativeMax(group.length, length);
              return true;
            }
          });
          return baseTimes(length, function(index) {
            return arrayMap(array, baseProperty(index));
          });
        }
        function unzipWith(array, iteratee2) {
          if (!(array && array.length)) {
            return [];
          }
          var result2 = unzip(array);
          if (iteratee2 == null) {
            return result2;
          }
          return arrayMap(result2, function(group) {
            return apply(iteratee2, undefined2, group);
          });
        }
        var without = baseRest(function(array, values2) {
          return isArrayLikeObject(array) ? baseDifference(array, values2) : [];
        });
        var xor = baseRest(function(arrays) {
          return baseXor(arrayFilter(arrays, isArrayLikeObject));
        });
        var xorBy = baseRest(function(arrays) {
          var iteratee2 = last(arrays);
          if (isArrayLikeObject(iteratee2)) {
            iteratee2 = undefined2;
          }
          return baseXor(arrayFilter(arrays, isArrayLikeObject), getIteratee(iteratee2, 2));
        });
        var xorWith = baseRest(function(arrays) {
          var comparator = last(arrays);
          comparator = typeof comparator == "function" ? comparator : undefined2;
          return baseXor(arrayFilter(arrays, isArrayLikeObject), undefined2, comparator);
        });
        var zip = baseRest(unzip);
        function zipObject(props, values2) {
          return baseZipObject(props || [], values2 || [], assignValue);
        }
        function zipObjectDeep(props, values2) {
          return baseZipObject(props || [], values2 || [], baseSet);
        }
        var zipWith = baseRest(function(arrays) {
          var length = arrays.length, iteratee2 = length > 1 ? arrays[length - 1] : undefined2;
          iteratee2 = typeof iteratee2 == "function" ? (arrays.pop(), iteratee2) : undefined2;
          return unzipWith(arrays, iteratee2);
        });
        function chain(value) {
          var result2 = lodash(value);
          result2.__chain__ = true;
          return result2;
        }
        function tap(value, interceptor) {
          interceptor(value);
          return value;
        }
        function thru(value, interceptor) {
          return interceptor(value);
        }
        var wrapperAt = flatRest(function(paths) {
          var length = paths.length, start = length ? paths[0] : 0, value = this.__wrapped__, interceptor = function(object) {
            return baseAt(object, paths);
          };
          if (length > 1 || this.__actions__.length || !(value instanceof LazyWrapper) || !isIndex(start)) {
            return this.thru(interceptor);
          }
          value = value.slice(start, +start + (length ? 1 : 0));
          value.__actions__.push({
            "func": thru,
            "args": [interceptor],
            "thisArg": undefined2
          });
          return new LodashWrapper(value, this.__chain__).thru(function(array) {
            if (length && !array.length) {
              array.push(undefined2);
            }
            return array;
          });
        });
        function wrapperChain() {
          return chain(this);
        }
        function wrapperCommit() {
          return new LodashWrapper(this.value(), this.__chain__);
        }
        function wrapperNext() {
          if (this.__values__ === undefined2) {
            this.__values__ = toArray(this.value());
          }
          var done = this.__index__ >= this.__values__.length, value = done ? undefined2 : this.__values__[this.__index__++];
          return { "done": done, "value": value };
        }
        function wrapperToIterator() {
          return this;
        }
        function wrapperPlant(value) {
          var result2, parent2 = this;
          while (parent2 instanceof baseLodash) {
            var clone2 = wrapperClone(parent2);
            clone2.__index__ = 0;
            clone2.__values__ = undefined2;
            if (result2) {
              previous.__wrapped__ = clone2;
            } else {
              result2 = clone2;
            }
            var previous = clone2;
            parent2 = parent2.__wrapped__;
          }
          previous.__wrapped__ = value;
          return result2;
        }
        function wrapperReverse() {
          var value = this.__wrapped__;
          if (value instanceof LazyWrapper) {
            var wrapped = value;
            if (this.__actions__.length) {
              wrapped = new LazyWrapper(this);
            }
            wrapped = wrapped.reverse();
            wrapped.__actions__.push({
              "func": thru,
              "args": [reverse],
              "thisArg": undefined2
            });
            return new LodashWrapper(wrapped, this.__chain__);
          }
          return this.thru(reverse);
        }
        function wrapperValue() {
          return baseWrapperValue(this.__wrapped__, this.__actions__);
        }
        var countBy2 = createAggregator(function(result2, value, key) {
          if (hasOwnProperty.call(result2, key)) {
            ++result2[key];
          } else {
            baseAssignValue(result2, key, 1);
          }
        });
        function every(collection, predicate, guard) {
          var func = isArray(collection) ? arrayEvery : baseEvery;
          if (guard && isIterateeCall(collection, predicate, guard)) {
            predicate = undefined2;
          }
          return func(collection, getIteratee(predicate, 3));
        }
        function filter(collection, predicate) {
          var func = isArray(collection) ? arrayFilter : baseFilter;
          return func(collection, getIteratee(predicate, 3));
        }
        var find = createFind(findIndex);
        var findLast = createFind(findLastIndex);
        function flatMap(collection, iteratee2) {
          return baseFlatten(map(collection, iteratee2), 1);
        }
        function flatMapDeep(collection, iteratee2) {
          return baseFlatten(map(collection, iteratee2), INFINITY);
        }
        function flatMapDepth(collection, iteratee2, depth) {
          depth = depth === undefined2 ? 1 : toInteger(depth);
          return baseFlatten(map(collection, iteratee2), depth);
        }
        function forEach(collection, iteratee2) {
          var func = isArray(collection) ? arrayEach : baseEach;
          return func(collection, getIteratee(iteratee2, 3));
        }
        function forEachRight(collection, iteratee2) {
          var func = isArray(collection) ? arrayEachRight : baseEachRight;
          return func(collection, getIteratee(iteratee2, 3));
        }
        var groupBy = createAggregator(function(result2, value, key) {
          if (hasOwnProperty.call(result2, key)) {
            result2[key].push(value);
          } else {
            baseAssignValue(result2, key, [value]);
          }
        });
        function includes(collection, value, fromIndex, guard) {
          collection = isArrayLike(collection) ? collection : values(collection);
          fromIndex = fromIndex && !guard ? toInteger(fromIndex) : 0;
          var length = collection.length;
          if (fromIndex < 0) {
            fromIndex = nativeMax(length + fromIndex, 0);
          }
          return isString(collection) ? fromIndex <= length && collection.indexOf(value, fromIndex) > -1 : !!length && baseIndexOf(collection, value, fromIndex) > -1;
        }
        var invokeMap = baseRest(function(collection, path, args) {
          var index = -1, isFunc = typeof path == "function", result2 = isArrayLike(collection) ? Array2(collection.length) : [];
          baseEach(collection, function(value) {
            result2[++index] = isFunc ? apply(path, value, args) : baseInvoke(value, path, args);
          });
          return result2;
        });
        var keyBy = createAggregator(function(result2, value, key) {
          baseAssignValue(result2, key, value);
        });
        function map(collection, iteratee2) {
          var func = isArray(collection) ? arrayMap : baseMap;
          return func(collection, getIteratee(iteratee2, 3));
        }
        function orderBy(collection, iteratees, orders, guard) {
          if (collection == null) {
            return [];
          }
          if (!isArray(iteratees)) {
            iteratees = iteratees == null ? [] : [iteratees];
          }
          orders = guard ? undefined2 : orders;
          if (!isArray(orders)) {
            orders = orders == null ? [] : [orders];
          }
          return baseOrderBy(collection, iteratees, orders);
        }
        var partition = createAggregator(function(result2, value, key) {
          result2[key ? 0 : 1].push(value);
        }, function() {
          return [[], []];
        });
        function reduce(collection, iteratee2, accumulator) {
          var func = isArray(collection) ? arrayReduce : baseReduce, initAccum = arguments.length < 3;
          return func(collection, getIteratee(iteratee2, 4), accumulator, initAccum, baseEach);
        }
        function reduceRight(collection, iteratee2, accumulator) {
          var func = isArray(collection) ? arrayReduceRight : baseReduce, initAccum = arguments.length < 3;
          return func(collection, getIteratee(iteratee2, 4), accumulator, initAccum, baseEachRight);
        }
        function reject(collection, predicate) {
          var func = isArray(collection) ? arrayFilter : baseFilter;
          return func(collection, negate(getIteratee(predicate, 3)));
        }
        function sample(collection) {
          var func = isArray(collection) ? arraySample : baseSample;
          return func(collection);
        }
        function sampleSize(collection, n, guard) {
          if (guard ? isIterateeCall(collection, n, guard) : n === undefined2) {
            n = 1;
          } else {
            n = toInteger(n);
          }
          var func = isArray(collection) ? arraySampleSize : baseSampleSize;
          return func(collection, n);
        }
        function shuffle(collection) {
          var func = isArray(collection) ? arrayShuffle : baseShuffle;
          return func(collection);
        }
        function size(collection) {
          if (collection == null) {
            return 0;
          }
          if (isArrayLike(collection)) {
            return isString(collection) ? stringSize(collection) : collection.length;
          }
          var tag = getTag(collection);
          if (tag == mapTag || tag == setTag) {
            return collection.size;
          }
          return baseKeys(collection).length;
        }
        function some(collection, predicate, guard) {
          var func = isArray(collection) ? arraySome : baseSome;
          if (guard && isIterateeCall(collection, predicate, guard)) {
            predicate = undefined2;
          }
          return func(collection, getIteratee(predicate, 3));
        }
        var sortBy = baseRest(function(collection, iteratees) {
          if (collection == null) {
            return [];
          }
          var length = iteratees.length;
          if (length > 1 && isIterateeCall(collection, iteratees[0], iteratees[1])) {
            iteratees = [];
          } else if (length > 2 && isIterateeCall(iteratees[0], iteratees[1], iteratees[2])) {
            iteratees = [iteratees[0]];
          }
          return baseOrderBy(collection, baseFlatten(iteratees, 1), []);
        });
        var now = ctxNow || function() {
          return root.Date.now();
        };
        function after(n, func) {
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          n = toInteger(n);
          return function() {
            if (--n < 1) {
              return func.apply(this, arguments);
            }
          };
        }
        function ary(func, n, guard) {
          n = guard ? undefined2 : n;
          n = func && n == null ? func.length : n;
          return createWrap(func, WRAP_ARY_FLAG, undefined2, undefined2, undefined2, undefined2, n);
        }
        function before(n, func) {
          var result2;
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          n = toInteger(n);
          return function() {
            if (--n > 0) {
              result2 = func.apply(this, arguments);
            }
            if (n <= 1) {
              func = undefined2;
            }
            return result2;
          };
        }
        var bind = baseRest(function(func, thisArg, partials) {
          var bitmask = WRAP_BIND_FLAG;
          if (partials.length) {
            var holders = replaceHolders(partials, getHolder(bind));
            bitmask |= WRAP_PARTIAL_FLAG;
          }
          return createWrap(func, bitmask, thisArg, partials, holders);
        });
        var bindKey = baseRest(function(object, key, partials) {
          var bitmask = WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG;
          if (partials.length) {
            var holders = replaceHolders(partials, getHolder(bindKey));
            bitmask |= WRAP_PARTIAL_FLAG;
          }
          return createWrap(key, bitmask, object, partials, holders);
        });
        function curry(func, arity, guard) {
          arity = guard ? undefined2 : arity;
          var result2 = createWrap(func, WRAP_CURRY_FLAG, undefined2, undefined2, undefined2, undefined2, undefined2, arity);
          result2.placeholder = curry.placeholder;
          return result2;
        }
        function curryRight(func, arity, guard) {
          arity = guard ? undefined2 : arity;
          var result2 = createWrap(func, WRAP_CURRY_RIGHT_FLAG, undefined2, undefined2, undefined2, undefined2, undefined2, arity);
          result2.placeholder = curryRight.placeholder;
          return result2;
        }
        function debounce(func, wait, options) {
          var lastArgs, lastThis, maxWait, result2, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          wait = toNumber(wait) || 0;
          if (isObject(options)) {
            leading = !!options.leading;
            maxing = "maxWait" in options;
            maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
            trailing = "trailing" in options ? !!options.trailing : trailing;
          }
          function invokeFunc(time) {
            var args = lastArgs, thisArg = lastThis;
            lastArgs = lastThis = undefined2;
            lastInvokeTime = time;
            result2 = func.apply(thisArg, args);
            return result2;
          }
          function leadingEdge(time) {
            lastInvokeTime = time;
            timerId = setTimeout(timerExpired, wait);
            return leading ? invokeFunc(time) : result2;
          }
          function remainingWait(time) {
            var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, timeWaiting = wait - timeSinceLastCall;
            return maxing ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
          }
          function shouldInvoke(time) {
            var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
            return lastCallTime === undefined2 || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
          }
          function timerExpired() {
            var time = now();
            if (shouldInvoke(time)) {
              return trailingEdge(time);
            }
            timerId = setTimeout(timerExpired, remainingWait(time));
          }
          function trailingEdge(time) {
            timerId = undefined2;
            if (trailing && lastArgs) {
              return invokeFunc(time);
            }
            lastArgs = lastThis = undefined2;
            return result2;
          }
          function cancel() {
            if (timerId !== undefined2) {
              clearTimeout(timerId);
            }
            lastInvokeTime = 0;
            lastArgs = lastCallTime = lastThis = timerId = undefined2;
          }
          function flush() {
            return timerId === undefined2 ? result2 : trailingEdge(now());
          }
          function debounced() {
            var time = now(), isInvoking = shouldInvoke(time);
            lastArgs = arguments;
            lastThis = this;
            lastCallTime = time;
            if (isInvoking) {
              if (timerId === undefined2) {
                return leadingEdge(lastCallTime);
              }
              if (maxing) {
                clearTimeout(timerId);
                timerId = setTimeout(timerExpired, wait);
                return invokeFunc(lastCallTime);
              }
            }
            if (timerId === undefined2) {
              timerId = setTimeout(timerExpired, wait);
            }
            return result2;
          }
          debounced.cancel = cancel;
          debounced.flush = flush;
          return debounced;
        }
        var defer = baseRest(function(func, args) {
          return baseDelay(func, 1, args);
        });
        var delay = baseRest(function(func, wait, args) {
          return baseDelay(func, toNumber(wait) || 0, args);
        });
        function flip(func) {
          return createWrap(func, WRAP_FLIP_FLAG);
        }
        function memoize(func, resolver) {
          if (typeof func != "function" || resolver != null && typeof resolver != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          var memoized = function() {
            var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
            if (cache.has(key)) {
              return cache.get(key);
            }
            var result2 = func.apply(this, args);
            memoized.cache = cache.set(key, result2) || cache;
            return result2;
          };
          memoized.cache = new (memoize.Cache || MapCache)();
          return memoized;
        }
        memoize.Cache = MapCache;
        function negate(predicate) {
          if (typeof predicate != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          return function() {
            var args = arguments;
            switch (args.length) {
              case 0:
                return !predicate.call(this);
              case 1:
                return !predicate.call(this, args[0]);
              case 2:
                return !predicate.call(this, args[0], args[1]);
              case 3:
                return !predicate.call(this, args[0], args[1], args[2]);
            }
            return !predicate.apply(this, args);
          };
        }
        function once(func) {
          return before(2, func);
        }
        var overArgs = castRest(function(func, transforms) {
          transforms = transforms.length == 1 && isArray(transforms[0]) ? arrayMap(transforms[0], baseUnary(getIteratee())) : arrayMap(baseFlatten(transforms, 1), baseUnary(getIteratee()));
          var funcsLength = transforms.length;
          return baseRest(function(args) {
            var index = -1, length = nativeMin(args.length, funcsLength);
            while (++index < length) {
              args[index] = transforms[index].call(this, args[index]);
            }
            return apply(func, this, args);
          });
        });
        var partial = baseRest(function(func, partials) {
          var holders = replaceHolders(partials, getHolder(partial));
          return createWrap(func, WRAP_PARTIAL_FLAG, undefined2, partials, holders);
        });
        var partialRight = baseRest(function(func, partials) {
          var holders = replaceHolders(partials, getHolder(partialRight));
          return createWrap(func, WRAP_PARTIAL_RIGHT_FLAG, undefined2, partials, holders);
        });
        var rearg = flatRest(function(func, indexes) {
          return createWrap(func, WRAP_REARG_FLAG, undefined2, undefined2, undefined2, indexes);
        });
        function rest(func, start) {
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          start = start === undefined2 ? start : toInteger(start);
          return baseRest(func, start);
        }
        function spread(func, start) {
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          start = start == null ? 0 : nativeMax(toInteger(start), 0);
          return baseRest(function(args) {
            var array = args[start], otherArgs = castSlice(args, 0, start);
            if (array) {
              arrayPush(otherArgs, array);
            }
            return apply(func, this, otherArgs);
          });
        }
        function throttle(func, wait, options) {
          var leading = true, trailing = true;
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          if (isObject(options)) {
            leading = "leading" in options ? !!options.leading : leading;
            trailing = "trailing" in options ? !!options.trailing : trailing;
          }
          return debounce(func, wait, {
            "leading": leading,
            "maxWait": wait,
            "trailing": trailing
          });
        }
        function unary(func) {
          return ary(func, 1);
        }
        function wrap(value, wrapper) {
          return partial(castFunction(wrapper), value);
        }
        function castArray() {
          if (!arguments.length) {
            return [];
          }
          var value = arguments[0];
          return isArray(value) ? value : [value];
        }
        function clone(value) {
          return baseClone(value, CLONE_SYMBOLS_FLAG);
        }
        function cloneWith(value, customizer) {
          customizer = typeof customizer == "function" ? customizer : undefined2;
          return baseClone(value, CLONE_SYMBOLS_FLAG, customizer);
        }
        function cloneDeep(value) {
          return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG);
        }
        function cloneDeepWith(value, customizer) {
          customizer = typeof customizer == "function" ? customizer : undefined2;
          return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG, customizer);
        }
        function conformsTo(object, source) {
          return source == null || baseConformsTo(object, source, keys(source));
        }
        function eq(value, other) {
          return value === other || value !== value && other !== other;
        }
        var gt = createRelationalOperation(baseGt);
        var gte = createRelationalOperation(function(value, other) {
          return value >= other;
        });
        var isArguments = baseIsArguments(function() {
          return arguments;
        }()) ? baseIsArguments : function(value) {
          return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
        };
        var isArray = Array2.isArray;
        var isArrayBuffer = nodeIsArrayBuffer ? baseUnary(nodeIsArrayBuffer) : baseIsArrayBuffer;
        function isArrayLike(value) {
          return value != null && isLength(value.length) && !isFunction(value);
        }
        function isArrayLikeObject(value) {
          return isObjectLike(value) && isArrayLike(value);
        }
        function isBoolean(value) {
          return value === true || value === false || isObjectLike(value) && baseGetTag(value) == boolTag;
        }
        var isBuffer = nativeIsBuffer || stubFalse;
        var isDate = nodeIsDate ? baseUnary(nodeIsDate) : baseIsDate;
        function isElement(value) {
          return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value);
        }
        function isEmpty(value) {
          if (value == null) {
            return true;
          }
          if (isArrayLike(value) && (isArray(value) || typeof value == "string" || typeof value.splice == "function" || isBuffer(value) || isTypedArray(value) || isArguments(value))) {
            return !value.length;
          }
          var tag = getTag(value);
          if (tag == mapTag || tag == setTag) {
            return !value.size;
          }
          if (isPrototype(value)) {
            return !baseKeys(value).length;
          }
          for (var key in value) {
            if (hasOwnProperty.call(value, key)) {
              return false;
            }
          }
          return true;
        }
        function isEqual(value, other) {
          return baseIsEqual(value, other);
        }
        function isEqualWith(value, other, customizer) {
          customizer = typeof customizer == "function" ? customizer : undefined2;
          var result2 = customizer ? customizer(value, other) : undefined2;
          return result2 === undefined2 ? baseIsEqual(value, other, undefined2, customizer) : !!result2;
        }
        function isError(value) {
          if (!isObjectLike(value)) {
            return false;
          }
          var tag = baseGetTag(value);
          return tag == errorTag || tag == domExcTag || typeof value.message == "string" && typeof value.name == "string" && !isPlainObject(value);
        }
        function isFinite(value) {
          return typeof value == "number" && nativeIsFinite(value);
        }
        function isFunction(value) {
          if (!isObject(value)) {
            return false;
          }
          var tag = baseGetTag(value);
          return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
        }
        function isInteger(value) {
          return typeof value == "number" && value == toInteger(value);
        }
        function isLength(value) {
          return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
        }
        function isObject(value) {
          var type = typeof value;
          return value != null && (type == "object" || type == "function");
        }
        function isObjectLike(value) {
          return value != null && typeof value == "object";
        }
        var isMap = nodeIsMap ? baseUnary(nodeIsMap) : baseIsMap;
        function isMatch(object, source) {
          return object === source || baseIsMatch(object, source, getMatchData(source));
        }
        function isMatchWith(object, source, customizer) {
          customizer = typeof customizer == "function" ? customizer : undefined2;
          return baseIsMatch(object, source, getMatchData(source), customizer);
        }
        function isNaN(value) {
          return isNumber(value) && value != +value;
        }
        function isNative(value) {
          if (isMaskable(value)) {
            throw new Error2(CORE_ERROR_TEXT);
          }
          return baseIsNative(value);
        }
        function isNull(value) {
          return value === null;
        }
        function isNil(value) {
          return value == null;
        }
        function isNumber(value) {
          return typeof value == "number" || isObjectLike(value) && baseGetTag(value) == numberTag;
        }
        function isPlainObject(value) {
          if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
            return false;
          }
          var proto = getPrototype(value);
          if (proto === null) {
            return true;
          }
          var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
          return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
        }
        var isRegExp = nodeIsRegExp ? baseUnary(nodeIsRegExp) : baseIsRegExp;
        function isSafeInteger(value) {
          return isInteger(value) && value >= -MAX_SAFE_INTEGER && value <= MAX_SAFE_INTEGER;
        }
        var isSet = nodeIsSet ? baseUnary(nodeIsSet) : baseIsSet;
        function isString(value) {
          return typeof value == "string" || !isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag;
        }
        function isSymbol(value) {
          return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
        }
        var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
        function isUndefined(value) {
          return value === undefined2;
        }
        function isWeakMap(value) {
          return isObjectLike(value) && getTag(value) == weakMapTag;
        }
        function isWeakSet(value) {
          return isObjectLike(value) && baseGetTag(value) == weakSetTag;
        }
        var lt = createRelationalOperation(baseLt);
        var lte = createRelationalOperation(function(value, other) {
          return value <= other;
        });
        function toArray(value) {
          if (!value) {
            return [];
          }
          if (isArrayLike(value)) {
            return isString(value) ? stringToArray(value) : copyArray(value);
          }
          if (symIterator && value[symIterator]) {
            return iteratorToArray(value[symIterator]());
          }
          var tag = getTag(value), func = tag == mapTag ? mapToArray : tag == setTag ? setToArray : values;
          return func(value);
        }
        function toFinite(value) {
          if (!value) {
            return value === 0 ? value : 0;
          }
          value = toNumber(value);
          if (value === INFINITY || value === -INFINITY) {
            var sign = value < 0 ? -1 : 1;
            return sign * MAX_INTEGER;
          }
          return value === value ? value : 0;
        }
        function toInteger(value) {
          var result2 = toFinite(value), remainder = result2 % 1;
          return result2 === result2 ? remainder ? result2 - remainder : result2 : 0;
        }
        function toLength(value) {
          return value ? baseClamp(toInteger(value), 0, MAX_ARRAY_LENGTH) : 0;
        }
        function toNumber(value) {
          if (typeof value == "number") {
            return value;
          }
          if (isSymbol(value)) {
            return NAN;
          }
          if (isObject(value)) {
            var other = typeof value.valueOf == "function" ? value.valueOf() : value;
            value = isObject(other) ? other + "" : other;
          }
          if (typeof value != "string") {
            return value === 0 ? value : +value;
          }
          value = baseTrim(value);
          var isBinary = reIsBinary.test(value);
          return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
        }
        function toPlainObject(value) {
          return copyObject(value, keysIn(value));
        }
        function toSafeInteger(value) {
          return value ? baseClamp(toInteger(value), -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER) : value === 0 ? value : 0;
        }
        function toString(value) {
          return value == null ? "" : baseToString(value);
        }
        var assign = createAssigner(function(object, source) {
          if (isPrototype(source) || isArrayLike(source)) {
            copyObject(source, keys(source), object);
            return;
          }
          for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
              assignValue(object, key, source[key]);
            }
          }
        });
        var assignIn = createAssigner(function(object, source) {
          copyObject(source, keysIn(source), object);
        });
        var assignInWith = createAssigner(function(object, source, srcIndex, customizer) {
          copyObject(source, keysIn(source), object, customizer);
        });
        var assignWith = createAssigner(function(object, source, srcIndex, customizer) {
          copyObject(source, keys(source), object, customizer);
        });
        var at = flatRest(baseAt);
        function create(prototype, properties) {
          var result2 = baseCreate(prototype);
          return properties == null ? result2 : baseAssign(result2, properties);
        }
        var defaults = baseRest(function(object, sources) {
          object = Object2(object);
          var index = -1;
          var length = sources.length;
          var guard = length > 2 ? sources[2] : undefined2;
          if (guard && isIterateeCall(sources[0], sources[1], guard)) {
            length = 1;
          }
          while (++index < length) {
            var source = sources[index];
            var props = keysIn(source);
            var propsIndex = -1;
            var propsLength = props.length;
            while (++propsIndex < propsLength) {
              var key = props[propsIndex];
              var value = object[key];
              if (value === undefined2 || eq(value, objectProto[key]) && !hasOwnProperty.call(object, key)) {
                object[key] = source[key];
              }
            }
          }
          return object;
        });
        var defaultsDeep = baseRest(function(args) {
          args.push(undefined2, customDefaultsMerge);
          return apply(mergeWith, undefined2, args);
        });
        function findKey(object, predicate) {
          return baseFindKey(object, getIteratee(predicate, 3), baseForOwn);
        }
        function findLastKey(object, predicate) {
          return baseFindKey(object, getIteratee(predicate, 3), baseForOwnRight);
        }
        function forIn(object, iteratee2) {
          return object == null ? object : baseFor(object, getIteratee(iteratee2, 3), keysIn);
        }
        function forInRight(object, iteratee2) {
          return object == null ? object : baseForRight(object, getIteratee(iteratee2, 3), keysIn);
        }
        function forOwn(object, iteratee2) {
          return object && baseForOwn(object, getIteratee(iteratee2, 3));
        }
        function forOwnRight(object, iteratee2) {
          return object && baseForOwnRight(object, getIteratee(iteratee2, 3));
        }
        function functions(object) {
          return object == null ? [] : baseFunctions(object, keys(object));
        }
        function functionsIn(object) {
          return object == null ? [] : baseFunctions(object, keysIn(object));
        }
        function get(object, path, defaultValue) {
          var result2 = object == null ? undefined2 : baseGet(object, path);
          return result2 === undefined2 ? defaultValue : result2;
        }
        function has(object, path) {
          return object != null && hasPath(object, path, baseHas);
        }
        function hasIn(object, path) {
          return object != null && hasPath(object, path, baseHasIn);
        }
        var invert = createInverter(function(result2, value, key) {
          if (value != null && typeof value.toString != "function") {
            value = nativeObjectToString.call(value);
          }
          result2[value] = key;
        }, constant(identity));
        var invertBy = createInverter(function(result2, value, key) {
          if (value != null && typeof value.toString != "function") {
            value = nativeObjectToString.call(value);
          }
          if (hasOwnProperty.call(result2, value)) {
            result2[value].push(key);
          } else {
            result2[value] = [key];
          }
        }, getIteratee);
        var invoke = baseRest(baseInvoke);
        function keys(object) {
          return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
        }
        function keysIn(object) {
          return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
        }
        function mapKeys(object, iteratee2) {
          var result2 = {};
          iteratee2 = getIteratee(iteratee2, 3);
          baseForOwn(object, function(value, key, object2) {
            baseAssignValue(result2, iteratee2(value, key, object2), value);
          });
          return result2;
        }
        function mapValues(object, iteratee2) {
          var result2 = {};
          iteratee2 = getIteratee(iteratee2, 3);
          baseForOwn(object, function(value, key, object2) {
            baseAssignValue(result2, key, iteratee2(value, key, object2));
          });
          return result2;
        }
        var merge = createAssigner(function(object, source, srcIndex) {
          baseMerge(object, source, srcIndex);
        });
        var mergeWith = createAssigner(function(object, source, srcIndex, customizer) {
          baseMerge(object, source, srcIndex, customizer);
        });
        var omit = flatRest(function(object, paths) {
          var result2 = {};
          if (object == null) {
            return result2;
          }
          var isDeep = false;
          paths = arrayMap(paths, function(path) {
            path = castPath(path, object);
            isDeep || (isDeep = path.length > 1);
            return path;
          });
          copyObject(object, getAllKeysIn(object), result2);
          if (isDeep) {
            result2 = baseClone(result2, CLONE_DEEP_FLAG | CLONE_FLAT_FLAG | CLONE_SYMBOLS_FLAG, customOmitClone);
          }
          var length = paths.length;
          while (length--) {
            baseUnset(result2, paths[length]);
          }
          return result2;
        });
        function omitBy(object, predicate) {
          return pickBy(object, negate(getIteratee(predicate)));
        }
        var pick = flatRest(function(object, paths) {
          return object == null ? {} : basePick(object, paths);
        });
        function pickBy(object, predicate) {
          if (object == null) {
            return {};
          }
          var props = arrayMap(getAllKeysIn(object), function(prop) {
            return [prop];
          });
          predicate = getIteratee(predicate);
          return basePickBy(object, props, function(value, path) {
            return predicate(value, path[0]);
          });
        }
        function result(object, path, defaultValue) {
          path = castPath(path, object);
          var index = -1, length = path.length;
          if (!length) {
            length = 1;
            object = undefined2;
          }
          while (++index < length) {
            var value = object == null ? undefined2 : object[toKey(path[index])];
            if (value === undefined2) {
              index = length;
              value = defaultValue;
            }
            object = isFunction(value) ? value.call(object) : value;
          }
          return object;
        }
        function set(object, path, value) {
          return object == null ? object : baseSet(object, path, value);
        }
        function setWith(object, path, value, customizer) {
          customizer = typeof customizer == "function" ? customizer : undefined2;
          return object == null ? object : baseSet(object, path, value, customizer);
        }
        var toPairs = createToPairs(keys);
        var toPairsIn = createToPairs(keysIn);
        function transform(object, iteratee2, accumulator) {
          var isArr = isArray(object), isArrLike = isArr || isBuffer(object) || isTypedArray(object);
          iteratee2 = getIteratee(iteratee2, 4);
          if (accumulator == null) {
            var Ctor = object && object.constructor;
            if (isArrLike) {
              accumulator = isArr ? new Ctor() : [];
            } else if (isObject(object)) {
              accumulator = isFunction(Ctor) ? baseCreate(getPrototype(object)) : {};
            } else {
              accumulator = {};
            }
          }
          (isArrLike ? arrayEach : baseForOwn)(object, function(value, index, object2) {
            return iteratee2(accumulator, value, index, object2);
          });
          return accumulator;
        }
        function unset(object, path) {
          return object == null ? true : baseUnset(object, path);
        }
        function update(object, path, updater) {
          return object == null ? object : baseUpdate(object, path, castFunction(updater));
        }
        function updateWith(object, path, updater, customizer) {
          customizer = typeof customizer == "function" ? customizer : undefined2;
          return object == null ? object : baseUpdate(object, path, castFunction(updater), customizer);
        }
        function values(object) {
          return object == null ? [] : baseValues(object, keys(object));
        }
        function valuesIn(object) {
          return object == null ? [] : baseValues(object, keysIn(object));
        }
        function clamp(number, lower, upper) {
          if (upper === undefined2) {
            upper = lower;
            lower = undefined2;
          }
          if (upper !== undefined2) {
            upper = toNumber(upper);
            upper = upper === upper ? upper : 0;
          }
          if (lower !== undefined2) {
            lower = toNumber(lower);
            lower = lower === lower ? lower : 0;
          }
          return baseClamp(toNumber(number), lower, upper);
        }
        function inRange(number, start, end) {
          start = toFinite(start);
          if (end === undefined2) {
            end = start;
            start = 0;
          } else {
            end = toFinite(end);
          }
          number = toNumber(number);
          return baseInRange(number, start, end);
        }
        function random(lower, upper, floating) {
          if (floating && typeof floating != "boolean" && isIterateeCall(lower, upper, floating)) {
            upper = floating = undefined2;
          }
          if (floating === undefined2) {
            if (typeof upper == "boolean") {
              floating = upper;
              upper = undefined2;
            } else if (typeof lower == "boolean") {
              floating = lower;
              lower = undefined2;
            }
          }
          if (lower === undefined2 && upper === undefined2) {
            lower = 0;
            upper = 1;
          } else {
            lower = toFinite(lower);
            if (upper === undefined2) {
              upper = lower;
              lower = 0;
            } else {
              upper = toFinite(upper);
            }
          }
          if (lower > upper) {
            var temp = lower;
            lower = upper;
            upper = temp;
          }
          if (floating || lower % 1 || upper % 1) {
            var rand = nativeRandom();
            return nativeMin(lower + rand * (upper - lower + freeParseFloat("1e-" + ((rand + "").length - 1))), upper);
          }
          return baseRandom(lower, upper);
        }
        var camelCase = createCompounder(function(result2, word, index) {
          word = word.toLowerCase();
          return result2 + (index ? capitalize(word) : word);
        });
        function capitalize(string) {
          return upperFirst(toString(string).toLowerCase());
        }
        function deburr(string) {
          string = toString(string);
          return string && string.replace(reLatin, deburrLetter).replace(reComboMark, "");
        }
        function endsWith(string, target, position) {
          string = toString(string);
          target = baseToString(target);
          var length = string.length;
          position = position === undefined2 ? length : baseClamp(toInteger(position), 0, length);
          var end = position;
          position -= target.length;
          return position >= 0 && string.slice(position, end) == target;
        }
        function escape(string) {
          string = toString(string);
          return string && reHasUnescapedHtml.test(string) ? string.replace(reUnescapedHtml, escapeHtmlChar) : string;
        }
        function escapeRegExp(string) {
          string = toString(string);
          return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, "\\$&") : string;
        }
        var kebabCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? "-" : "") + word.toLowerCase();
        });
        var lowerCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? " " : "") + word.toLowerCase();
        });
        var lowerFirst = createCaseFirst("toLowerCase");
        function pad(string, length, chars) {
          string = toString(string);
          length = toInteger(length);
          var strLength = length ? stringSize(string) : 0;
          if (!length || strLength >= length) {
            return string;
          }
          var mid = (length - strLength) / 2;
          return createPadding(nativeFloor(mid), chars) + string + createPadding(nativeCeil(mid), chars);
        }
        function padEnd(string, length, chars) {
          string = toString(string);
          length = toInteger(length);
          var strLength = length ? stringSize(string) : 0;
          return length && strLength < length ? string + createPadding(length - strLength, chars) : string;
        }
        function padStart(string, length, chars) {
          string = toString(string);
          length = toInteger(length);
          var strLength = length ? stringSize(string) : 0;
          return length && strLength < length ? createPadding(length - strLength, chars) + string : string;
        }
        function parseInt2(string, radix, guard) {
          if (guard || radix == null) {
            radix = 0;
          } else if (radix) {
            radix = +radix;
          }
          return nativeParseInt(toString(string).replace(reTrimStart, ""), radix || 0);
        }
        function repeat(string, n, guard) {
          if (guard ? isIterateeCall(string, n, guard) : n === undefined2) {
            n = 1;
          } else {
            n = toInteger(n);
          }
          return baseRepeat(toString(string), n);
        }
        function replace() {
          var args = arguments, string = toString(args[0]);
          return args.length < 3 ? string : string.replace(args[1], args[2]);
        }
        var snakeCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? "_" : "") + word.toLowerCase();
        });
        function split(string, separator, limit) {
          if (limit && typeof limit != "number" && isIterateeCall(string, separator, limit)) {
            separator = limit = undefined2;
          }
          limit = limit === undefined2 ? MAX_ARRAY_LENGTH : limit >>> 0;
          if (!limit) {
            return [];
          }
          string = toString(string);
          if (string && (typeof separator == "string" || separator != null && !isRegExp(separator))) {
            separator = baseToString(separator);
            if (!separator && hasUnicode(string)) {
              return castSlice(stringToArray(string), 0, limit);
            }
          }
          return string.split(separator, limit);
        }
        var startCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? " " : "") + upperFirst(word);
        });
        function startsWith(string, target, position) {
          string = toString(string);
          position = position == null ? 0 : baseClamp(toInteger(position), 0, string.length);
          target = baseToString(target);
          return string.slice(position, position + target.length) == target;
        }
        function template(string, options, guard) {
          var settings = lodash.templateSettings;
          if (guard && isIterateeCall(string, options, guard)) {
            options = undefined2;
          }
          string = toString(string);
          options = assignInWith({}, options, settings, customDefaultsAssignIn);
          var imports = assignInWith({}, options.imports, settings.imports, customDefaultsAssignIn), importsKeys = keys(imports), importsValues = baseValues(imports, importsKeys);
          var isEscaping, isEvaluating, index = 0, interpolate = options.interpolate || reNoMatch, source = "__p += '";
          var reDelimiters = RegExp2((options.escape || reNoMatch).source + "|" + interpolate.source + "|" + (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + "|" + (options.evaluate || reNoMatch).source + "|$", "g");
          var sourceURL = "//# sourceURL=" + (hasOwnProperty.call(options, "sourceURL") ? (options.sourceURL + "").replace(/\s/g, " ") : "lodash.templateSources[" + ++templateCounter + "]") + "\n";
          string.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
            interpolateValue || (interpolateValue = esTemplateValue);
            source += string.slice(index, offset).replace(reUnescapedString, escapeStringChar);
            if (escapeValue) {
              isEscaping = true;
              source += "' +\n__e(" + escapeValue + ") +\n'";
            }
            if (evaluateValue) {
              isEvaluating = true;
              source += "';\n" + evaluateValue + ";\n__p += '";
            }
            if (interpolateValue) {
              source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
            }
            index = offset + match.length;
            return match;
          });
          source += "';\n";
          var variable = hasOwnProperty.call(options, "variable") && options.variable;
          if (!variable) {
            source = "with (obj) {\n" + source + "\n}\n";
          } else if (reForbiddenIdentifierChars.test(variable)) {
            throw new Error2(INVALID_TEMPL_VAR_ERROR_TEXT);
          }
          source = (isEvaluating ? source.replace(reEmptyStringLeading, "") : source).replace(reEmptyStringMiddle, "$1").replace(reEmptyStringTrailing, "$1;");
          source = "function(" + (variable || "obj") + ") {\n" + (variable ? "" : "obj || (obj = {});\n") + "var __t, __p = ''" + (isEscaping ? ", __e = _.escape" : "") + (isEvaluating ? ", __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, '') }\n" : ";\n") + source + "return __p\n}";
          var result2 = attempt(function() {
            return Function2(importsKeys, sourceURL + "return " + source).apply(undefined2, importsValues);
          });
          result2.source = source;
          if (isError(result2)) {
            throw result2;
          }
          return result2;
        }
        function toLower(value) {
          return toString(value).toLowerCase();
        }
        function toUpper(value) {
          return toString(value).toUpperCase();
        }
        function trim(string, chars, guard) {
          string = toString(string);
          if (string && (guard || chars === undefined2)) {
            return baseTrim(string);
          }
          if (!string || !(chars = baseToString(chars))) {
            return string;
          }
          var strSymbols = stringToArray(string), chrSymbols = stringToArray(chars), start = charsStartIndex(strSymbols, chrSymbols), end = charsEndIndex(strSymbols, chrSymbols) + 1;
          return castSlice(strSymbols, start, end).join("");
        }
        function trimEnd(string, chars, guard) {
          string = toString(string);
          if (string && (guard || chars === undefined2)) {
            return string.slice(0, trimmedEndIndex(string) + 1);
          }
          if (!string || !(chars = baseToString(chars))) {
            return string;
          }
          var strSymbols = stringToArray(string), end = charsEndIndex(strSymbols, stringToArray(chars)) + 1;
          return castSlice(strSymbols, 0, end).join("");
        }
        function trimStart(string, chars, guard) {
          string = toString(string);
          if (string && (guard || chars === undefined2)) {
            return string.replace(reTrimStart, "");
          }
          if (!string || !(chars = baseToString(chars))) {
            return string;
          }
          var strSymbols = stringToArray(string), start = charsStartIndex(strSymbols, stringToArray(chars));
          return castSlice(strSymbols, start).join("");
        }
        function truncate(string, options) {
          var length = DEFAULT_TRUNC_LENGTH, omission = DEFAULT_TRUNC_OMISSION;
          if (isObject(options)) {
            var separator = "separator" in options ? options.separator : separator;
            length = "length" in options ? toInteger(options.length) : length;
            omission = "omission" in options ? baseToString(options.omission) : omission;
          }
          string = toString(string);
          var strLength = string.length;
          if (hasUnicode(string)) {
            var strSymbols = stringToArray(string);
            strLength = strSymbols.length;
          }
          if (length >= strLength) {
            return string;
          }
          var end = length - stringSize(omission);
          if (end < 1) {
            return omission;
          }
          var result2 = strSymbols ? castSlice(strSymbols, 0, end).join("") : string.slice(0, end);
          if (separator === undefined2) {
            return result2 + omission;
          }
          if (strSymbols) {
            end += result2.length - end;
          }
          if (isRegExp(separator)) {
            if (string.slice(end).search(separator)) {
              var match, substring = result2;
              if (!separator.global) {
                separator = RegExp2(separator.source, toString(reFlags.exec(separator)) + "g");
              }
              separator.lastIndex = 0;
              while (match = separator.exec(substring)) {
                var newEnd = match.index;
              }
              result2 = result2.slice(0, newEnd === undefined2 ? end : newEnd);
            }
          } else if (string.indexOf(baseToString(separator), end) != end) {
            var index = result2.lastIndexOf(separator);
            if (index > -1) {
              result2 = result2.slice(0, index);
            }
          }
          return result2 + omission;
        }
        function unescape2(string) {
          string = toString(string);
          return string && reHasEscapedHtml.test(string) ? string.replace(reEscapedHtml, unescapeHtmlChar) : string;
        }
        var upperCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? " " : "") + word.toUpperCase();
        });
        var upperFirst = createCaseFirst("toUpperCase");
        function words(string, pattern, guard) {
          string = toString(string);
          pattern = guard ? undefined2 : pattern;
          if (pattern === undefined2) {
            return hasUnicodeWord(string) ? unicodeWords(string) : asciiWords(string);
          }
          return string.match(pattern) || [];
        }
        var attempt = baseRest(function(func, args) {
          try {
            return apply(func, undefined2, args);
          } catch (e) {
            return isError(e) ? e : new Error2(e);
          }
        });
        var bindAll = flatRest(function(object, methodNames) {
          arrayEach(methodNames, function(key) {
            key = toKey(key);
            baseAssignValue(object, key, bind(object[key], object));
          });
          return object;
        });
        function cond(pairs) {
          var length = pairs == null ? 0 : pairs.length, toIteratee = getIteratee();
          pairs = !length ? [] : arrayMap(pairs, function(pair2) {
            if (typeof pair2[1] != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            return [toIteratee(pair2[0]), pair2[1]];
          });
          return baseRest(function(args) {
            var index = -1;
            while (++index < length) {
              var pair2 = pairs[index];
              if (apply(pair2[0], this, args)) {
                return apply(pair2[1], this, args);
              }
            }
          });
        }
        function conforms(source) {
          return baseConforms(baseClone(source, CLONE_DEEP_FLAG));
        }
        function constant(value) {
          return function() {
            return value;
          };
        }
        function defaultTo(value, defaultValue) {
          return value == null || value !== value ? defaultValue : value;
        }
        var flow = createFlow();
        var flowRight = createFlow(true);
        function identity(value) {
          return value;
        }
        function iteratee(func) {
          return baseIteratee(typeof func == "function" ? func : baseClone(func, CLONE_DEEP_FLAG));
        }
        function matches(source) {
          return baseMatches(baseClone(source, CLONE_DEEP_FLAG));
        }
        function matchesProperty(path, srcValue) {
          return baseMatchesProperty(path, baseClone(srcValue, CLONE_DEEP_FLAG));
        }
        var method = baseRest(function(path, args) {
          return function(object) {
            return baseInvoke(object, path, args);
          };
        });
        var methodOf = baseRest(function(object, args) {
          return function(path) {
            return baseInvoke(object, path, args);
          };
        });
        function mixin(object, source, options) {
          var props = keys(source), methodNames = baseFunctions(source, props);
          if (options == null && !(isObject(source) && (methodNames.length || !props.length))) {
            options = source;
            source = object;
            object = this;
            methodNames = baseFunctions(source, keys(source));
          }
          var chain2 = !(isObject(options) && "chain" in options) || !!options.chain, isFunc = isFunction(object);
          arrayEach(methodNames, function(methodName) {
            var func = source[methodName];
            object[methodName] = func;
            if (isFunc) {
              object.prototype[methodName] = function() {
                var chainAll = this.__chain__;
                if (chain2 || chainAll) {
                  var result2 = object(this.__wrapped__), actions = result2.__actions__ = copyArray(this.__actions__);
                  actions.push({ "func": func, "args": arguments, "thisArg": object });
                  result2.__chain__ = chainAll;
                  return result2;
                }
                return func.apply(object, arrayPush([this.value()], arguments));
              };
            }
          });
          return object;
        }
        function noConflict() {
          if (root._ === this) {
            root._ = oldDash;
          }
          return this;
        }
        function noop() {
        }
        function nthArg(n) {
          n = toInteger(n);
          return baseRest(function(args) {
            return baseNth(args, n);
          });
        }
        var over = createOver(arrayMap);
        var overEvery = createOver(arrayEvery);
        var overSome = createOver(arraySome);
        function property(path) {
          return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
        }
        function propertyOf(object) {
          return function(path) {
            return object == null ? undefined2 : baseGet(object, path);
          };
        }
        var range = createRange();
        var rangeRight = createRange(true);
        function stubArray() {
          return [];
        }
        function stubFalse() {
          return false;
        }
        function stubObject() {
          return {};
        }
        function stubString() {
          return "";
        }
        function stubTrue() {
          return true;
        }
        function times(n, iteratee2) {
          n = toInteger(n);
          if (n < 1 || n > MAX_SAFE_INTEGER) {
            return [];
          }
          var index = MAX_ARRAY_LENGTH, length = nativeMin(n, MAX_ARRAY_LENGTH);
          iteratee2 = getIteratee(iteratee2);
          n -= MAX_ARRAY_LENGTH;
          var result2 = baseTimes(length, iteratee2);
          while (++index < n) {
            iteratee2(index);
          }
          return result2;
        }
        function toPath(value) {
          if (isArray(value)) {
            return arrayMap(value, toKey);
          }
          return isSymbol(value) ? [value] : copyArray(stringToPath(toString(value)));
        }
        function uniqueId(prefix) {
          var id = ++idCounter;
          return toString(prefix) + id;
        }
        var add = createMathOperation(function(augend, addend) {
          return augend + addend;
        }, 0);
        var ceil = createRound("ceil");
        var divide = createMathOperation(function(dividend, divisor) {
          return dividend / divisor;
        }, 1);
        var floor = createRound("floor");
        function max(array) {
          return array && array.length ? baseExtremum(array, identity, baseGt) : undefined2;
        }
        function maxBy(array, iteratee2) {
          return array && array.length ? baseExtremum(array, getIteratee(iteratee2, 2), baseGt) : undefined2;
        }
        function mean(array) {
          return baseMean(array, identity);
        }
        function meanBy(array, iteratee2) {
          return baseMean(array, getIteratee(iteratee2, 2));
        }
        function min(array) {
          return array && array.length ? baseExtremum(array, identity, baseLt) : undefined2;
        }
        function minBy(array, iteratee2) {
          return array && array.length ? baseExtremum(array, getIteratee(iteratee2, 2), baseLt) : undefined2;
        }
        var multiply = createMathOperation(function(multiplier, multiplicand) {
          return multiplier * multiplicand;
        }, 1);
        var round = createRound("round");
        var subtract = createMathOperation(function(minuend, subtrahend) {
          return minuend - subtrahend;
        }, 0);
        function sum(array) {
          return array && array.length ? baseSum(array, identity) : 0;
        }
        function sumBy(array, iteratee2) {
          return array && array.length ? baseSum(array, getIteratee(iteratee2, 2)) : 0;
        }
        lodash.after = after;
        lodash.ary = ary;
        lodash.assign = assign;
        lodash.assignIn = assignIn;
        lodash.assignInWith = assignInWith;
        lodash.assignWith = assignWith;
        lodash.at = at;
        lodash.before = before;
        lodash.bind = bind;
        lodash.bindAll = bindAll;
        lodash.bindKey = bindKey;
        lodash.castArray = castArray;
        lodash.chain = chain;
        lodash.chunk = chunk;
        lodash.compact = compact;
        lodash.concat = concat;
        lodash.cond = cond;
        lodash.conforms = conforms;
        lodash.constant = constant;
        lodash.countBy = countBy2;
        lodash.create = create;
        lodash.curry = curry;
        lodash.curryRight = curryRight;
        lodash.debounce = debounce;
        lodash.defaults = defaults;
        lodash.defaultsDeep = defaultsDeep;
        lodash.defer = defer;
        lodash.delay = delay;
        lodash.difference = difference;
        lodash.differenceBy = differenceBy;
        lodash.differenceWith = differenceWith;
        lodash.drop = drop;
        lodash.dropRight = dropRight;
        lodash.dropRightWhile = dropRightWhile;
        lodash.dropWhile = dropWhile;
        lodash.fill = fill;
        lodash.filter = filter;
        lodash.flatMap = flatMap;
        lodash.flatMapDeep = flatMapDeep;
        lodash.flatMapDepth = flatMapDepth;
        lodash.flatten = flatten;
        lodash.flattenDeep = flattenDeep;
        lodash.flattenDepth = flattenDepth;
        lodash.flip = flip;
        lodash.flow = flow;
        lodash.flowRight = flowRight;
        lodash.fromPairs = fromPairs;
        lodash.functions = functions;
        lodash.functionsIn = functionsIn;
        lodash.groupBy = groupBy;
        lodash.initial = initial;
        lodash.intersection = intersection;
        lodash.intersectionBy = intersectionBy;
        lodash.intersectionWith = intersectionWith;
        lodash.invert = invert;
        lodash.invertBy = invertBy;
        lodash.invokeMap = invokeMap;
        lodash.iteratee = iteratee;
        lodash.keyBy = keyBy;
        lodash.keys = keys;
        lodash.keysIn = keysIn;
        lodash.map = map;
        lodash.mapKeys = mapKeys;
        lodash.mapValues = mapValues;
        lodash.matches = matches;
        lodash.matchesProperty = matchesProperty;
        lodash.memoize = memoize;
        lodash.merge = merge;
        lodash.mergeWith = mergeWith;
        lodash.method = method;
        lodash.methodOf = methodOf;
        lodash.mixin = mixin;
        lodash.negate = negate;
        lodash.nthArg = nthArg;
        lodash.omit = omit;
        lodash.omitBy = omitBy;
        lodash.once = once;
        lodash.orderBy = orderBy;
        lodash.over = over;
        lodash.overArgs = overArgs;
        lodash.overEvery = overEvery;
        lodash.overSome = overSome;
        lodash.partial = partial;
        lodash.partialRight = partialRight;
        lodash.partition = partition;
        lodash.pick = pick;
        lodash.pickBy = pickBy;
        lodash.property = property;
        lodash.propertyOf = propertyOf;
        lodash.pull = pull;
        lodash.pullAll = pullAll;
        lodash.pullAllBy = pullAllBy;
        lodash.pullAllWith = pullAllWith;
        lodash.pullAt = pullAt;
        lodash.range = range;
        lodash.rangeRight = rangeRight;
        lodash.rearg = rearg;
        lodash.reject = reject;
        lodash.remove = remove;
        lodash.rest = rest;
        lodash.reverse = reverse;
        lodash.sampleSize = sampleSize;
        lodash.set = set;
        lodash.setWith = setWith;
        lodash.shuffle = shuffle;
        lodash.slice = slice;
        lodash.sortBy = sortBy;
        lodash.sortedUniq = sortedUniq;
        lodash.sortedUniqBy = sortedUniqBy;
        lodash.split = split;
        lodash.spread = spread;
        lodash.tail = tail;
        lodash.take = take;
        lodash.takeRight = takeRight;
        lodash.takeRightWhile = takeRightWhile;
        lodash.takeWhile = takeWhile;
        lodash.tap = tap;
        lodash.throttle = throttle;
        lodash.thru = thru;
        lodash.toArray = toArray;
        lodash.toPairs = toPairs;
        lodash.toPairsIn = toPairsIn;
        lodash.toPath = toPath;
        lodash.toPlainObject = toPlainObject;
        lodash.transform = transform;
        lodash.unary = unary;
        lodash.union = union;
        lodash.unionBy = unionBy;
        lodash.unionWith = unionWith;
        lodash.uniq = uniq;
        lodash.uniqBy = uniqBy;
        lodash.uniqWith = uniqWith;
        lodash.unset = unset;
        lodash.unzip = unzip;
        lodash.unzipWith = unzipWith;
        lodash.update = update;
        lodash.updateWith = updateWith;
        lodash.values = values;
        lodash.valuesIn = valuesIn;
        lodash.without = without;
        lodash.words = words;
        lodash.wrap = wrap;
        lodash.xor = xor;
        lodash.xorBy = xorBy;
        lodash.xorWith = xorWith;
        lodash.zip = zip;
        lodash.zipObject = zipObject;
        lodash.zipObjectDeep = zipObjectDeep;
        lodash.zipWith = zipWith;
        lodash.entries = toPairs;
        lodash.entriesIn = toPairsIn;
        lodash.extend = assignIn;
        lodash.extendWith = assignInWith;
        mixin(lodash, lodash);
        lodash.add = add;
        lodash.attempt = attempt;
        lodash.camelCase = camelCase;
        lodash.capitalize = capitalize;
        lodash.ceil = ceil;
        lodash.clamp = clamp;
        lodash.clone = clone;
        lodash.cloneDeep = cloneDeep;
        lodash.cloneDeepWith = cloneDeepWith;
        lodash.cloneWith = cloneWith;
        lodash.conformsTo = conformsTo;
        lodash.deburr = deburr;
        lodash.defaultTo = defaultTo;
        lodash.divide = divide;
        lodash.endsWith = endsWith;
        lodash.eq = eq;
        lodash.escape = escape;
        lodash.escapeRegExp = escapeRegExp;
        lodash.every = every;
        lodash.find = find;
        lodash.findIndex = findIndex;
        lodash.findKey = findKey;
        lodash.findLast = findLast;
        lodash.findLastIndex = findLastIndex;
        lodash.findLastKey = findLastKey;
        lodash.floor = floor;
        lodash.forEach = forEach;
        lodash.forEachRight = forEachRight;
        lodash.forIn = forIn;
        lodash.forInRight = forInRight;
        lodash.forOwn = forOwn;
        lodash.forOwnRight = forOwnRight;
        lodash.get = get;
        lodash.gt = gt;
        lodash.gte = gte;
        lodash.has = has;
        lodash.hasIn = hasIn;
        lodash.head = head;
        lodash.identity = identity;
        lodash.includes = includes;
        lodash.indexOf = indexOf;
        lodash.inRange = inRange;
        lodash.invoke = invoke;
        lodash.isArguments = isArguments;
        lodash.isArray = isArray;
        lodash.isArrayBuffer = isArrayBuffer;
        lodash.isArrayLike = isArrayLike;
        lodash.isArrayLikeObject = isArrayLikeObject;
        lodash.isBoolean = isBoolean;
        lodash.isBuffer = isBuffer;
        lodash.isDate = isDate;
        lodash.isElement = isElement;
        lodash.isEmpty = isEmpty;
        lodash.isEqual = isEqual;
        lodash.isEqualWith = isEqualWith;
        lodash.isError = isError;
        lodash.isFinite = isFinite;
        lodash.isFunction = isFunction;
        lodash.isInteger = isInteger;
        lodash.isLength = isLength;
        lodash.isMap = isMap;
        lodash.isMatch = isMatch;
        lodash.isMatchWith = isMatchWith;
        lodash.isNaN = isNaN;
        lodash.isNative = isNative;
        lodash.isNil = isNil;
        lodash.isNull = isNull;
        lodash.isNumber = isNumber;
        lodash.isObject = isObject;
        lodash.isObjectLike = isObjectLike;
        lodash.isPlainObject = isPlainObject;
        lodash.isRegExp = isRegExp;
        lodash.isSafeInteger = isSafeInteger;
        lodash.isSet = isSet;
        lodash.isString = isString;
        lodash.isSymbol = isSymbol;
        lodash.isTypedArray = isTypedArray;
        lodash.isUndefined = isUndefined;
        lodash.isWeakMap = isWeakMap;
        lodash.isWeakSet = isWeakSet;
        lodash.join = join;
        lodash.kebabCase = kebabCase;
        lodash.last = last;
        lodash.lastIndexOf = lastIndexOf;
        lodash.lowerCase = lowerCase;
        lodash.lowerFirst = lowerFirst;
        lodash.lt = lt;
        lodash.lte = lte;
        lodash.max = max;
        lodash.maxBy = maxBy;
        lodash.mean = mean;
        lodash.meanBy = meanBy;
        lodash.min = min;
        lodash.minBy = minBy;
        lodash.stubArray = stubArray;
        lodash.stubFalse = stubFalse;
        lodash.stubObject = stubObject;
        lodash.stubString = stubString;
        lodash.stubTrue = stubTrue;
        lodash.multiply = multiply;
        lodash.nth = nth;
        lodash.noConflict = noConflict;
        lodash.noop = noop;
        lodash.now = now;
        lodash.pad = pad;
        lodash.padEnd = padEnd;
        lodash.padStart = padStart;
        lodash.parseInt = parseInt2;
        lodash.random = random;
        lodash.reduce = reduce;
        lodash.reduceRight = reduceRight;
        lodash.repeat = repeat;
        lodash.replace = replace;
        lodash.result = result;
        lodash.round = round;
        lodash.runInContext = runInContext2;
        lodash.sample = sample;
        lodash.size = size;
        lodash.snakeCase = snakeCase;
        lodash.some = some;
        lodash.sortedIndex = sortedIndex;
        lodash.sortedIndexBy = sortedIndexBy;
        lodash.sortedIndexOf = sortedIndexOf;
        lodash.sortedLastIndex = sortedLastIndex;
        lodash.sortedLastIndexBy = sortedLastIndexBy;
        lodash.sortedLastIndexOf = sortedLastIndexOf;
        lodash.startCase = startCase;
        lodash.startsWith = startsWith;
        lodash.subtract = subtract;
        lodash.sum = sum;
        lodash.sumBy = sumBy;
        lodash.template = template;
        lodash.times = times;
        lodash.toFinite = toFinite;
        lodash.toInteger = toInteger;
        lodash.toLength = toLength;
        lodash.toLower = toLower;
        lodash.toNumber = toNumber;
        lodash.toSafeInteger = toSafeInteger;
        lodash.toString = toString;
        lodash.toUpper = toUpper;
        lodash.trim = trim;
        lodash.trimEnd = trimEnd;
        lodash.trimStart = trimStart;
        lodash.truncate = truncate;
        lodash.unescape = unescape2;
        lodash.uniqueId = uniqueId;
        lodash.upperCase = upperCase;
        lodash.upperFirst = upperFirst;
        lodash.each = forEach;
        lodash.eachRight = forEachRight;
        lodash.first = head;
        mixin(lodash, function() {
          var source = {};
          baseForOwn(lodash, function(func, methodName) {
            if (!hasOwnProperty.call(lodash.prototype, methodName)) {
              source[methodName] = func;
            }
          });
          return source;
        }(), { "chain": false });
        lodash.VERSION = VERSION;
        arrayEach(["bind", "bindKey", "curry", "curryRight", "partial", "partialRight"], function(methodName) {
          lodash[methodName].placeholder = lodash;
        });
        arrayEach(["drop", "take"], function(methodName, index) {
          LazyWrapper.prototype[methodName] = function(n) {
            n = n === undefined2 ? 1 : nativeMax(toInteger(n), 0);
            var result2 = this.__filtered__ && !index ? new LazyWrapper(this) : this.clone();
            if (result2.__filtered__) {
              result2.__takeCount__ = nativeMin(n, result2.__takeCount__);
            } else {
              result2.__views__.push({
                "size": nativeMin(n, MAX_ARRAY_LENGTH),
                "type": methodName + (result2.__dir__ < 0 ? "Right" : "")
              });
            }
            return result2;
          };
          LazyWrapper.prototype[methodName + "Right"] = function(n) {
            return this.reverse()[methodName](n).reverse();
          };
        });
        arrayEach(["filter", "map", "takeWhile"], function(methodName, index) {
          var type = index + 1, isFilter = type == LAZY_FILTER_FLAG || type == LAZY_WHILE_FLAG;
          LazyWrapper.prototype[methodName] = function(iteratee2) {
            var result2 = this.clone();
            result2.__iteratees__.push({
              "iteratee": getIteratee(iteratee2, 3),
              "type": type
            });
            result2.__filtered__ = result2.__filtered__ || isFilter;
            return result2;
          };
        });
        arrayEach(["head", "last"], function(methodName, index) {
          var takeName = "take" + (index ? "Right" : "");
          LazyWrapper.prototype[methodName] = function() {
            return this[takeName](1).value()[0];
          };
        });
        arrayEach(["initial", "tail"], function(methodName, index) {
          var dropName = "drop" + (index ? "" : "Right");
          LazyWrapper.prototype[methodName] = function() {
            return this.__filtered__ ? new LazyWrapper(this) : this[dropName](1);
          };
        });
        LazyWrapper.prototype.compact = function() {
          return this.filter(identity);
        };
        LazyWrapper.prototype.find = function(predicate) {
          return this.filter(predicate).head();
        };
        LazyWrapper.prototype.findLast = function(predicate) {
          return this.reverse().find(predicate);
        };
        LazyWrapper.prototype.invokeMap = baseRest(function(path, args) {
          if (typeof path == "function") {
            return new LazyWrapper(this);
          }
          return this.map(function(value) {
            return baseInvoke(value, path, args);
          });
        });
        LazyWrapper.prototype.reject = function(predicate) {
          return this.filter(negate(getIteratee(predicate)));
        };
        LazyWrapper.prototype.slice = function(start, end) {
          start = toInteger(start);
          var result2 = this;
          if (result2.__filtered__ && (start > 0 || end < 0)) {
            return new LazyWrapper(result2);
          }
          if (start < 0) {
            result2 = result2.takeRight(-start);
          } else if (start) {
            result2 = result2.drop(start);
          }
          if (end !== undefined2) {
            end = toInteger(end);
            result2 = end < 0 ? result2.dropRight(-end) : result2.take(end - start);
          }
          return result2;
        };
        LazyWrapper.prototype.takeRightWhile = function(predicate) {
          return this.reverse().takeWhile(predicate).reverse();
        };
        LazyWrapper.prototype.toArray = function() {
          return this.take(MAX_ARRAY_LENGTH);
        };
        baseForOwn(LazyWrapper.prototype, function(func, methodName) {
          var checkIteratee = /^(?:filter|find|map|reject)|While$/.test(methodName), isTaker = /^(?:head|last)$/.test(methodName), lodashFunc = lodash[isTaker ? "take" + (methodName == "last" ? "Right" : "") : methodName], retUnwrapped = isTaker || /^find/.test(methodName);
          if (!lodashFunc) {
            return;
          }
          lodash.prototype[methodName] = function() {
            var value = this.__wrapped__, args = isTaker ? [1] : arguments, isLazy = value instanceof LazyWrapper, iteratee2 = args[0], useLazy = isLazy || isArray(value);
            var interceptor = function(value2) {
              var result3 = lodashFunc.apply(lodash, arrayPush([value2], args));
              return isTaker && chainAll ? result3[0] : result3;
            };
            if (useLazy && checkIteratee && typeof iteratee2 == "function" && iteratee2.length != 1) {
              isLazy = useLazy = false;
            }
            var chainAll = this.__chain__, isHybrid = !!this.__actions__.length, isUnwrapped = retUnwrapped && !chainAll, onlyLazy = isLazy && !isHybrid;
            if (!retUnwrapped && useLazy) {
              value = onlyLazy ? value : new LazyWrapper(this);
              var result2 = func.apply(value, args);
              result2.__actions__.push({ "func": thru, "args": [interceptor], "thisArg": undefined2 });
              return new LodashWrapper(result2, chainAll);
            }
            if (isUnwrapped && onlyLazy) {
              return func.apply(this, args);
            }
            result2 = this.thru(interceptor);
            return isUnwrapped ? isTaker ? result2.value()[0] : result2.value() : result2;
          };
        });
        arrayEach(["pop", "push", "shift", "sort", "splice", "unshift"], function(methodName) {
          var func = arrayProto[methodName], chainName = /^(?:push|sort|unshift)$/.test(methodName) ? "tap" : "thru", retUnwrapped = /^(?:pop|shift)$/.test(methodName);
          lodash.prototype[methodName] = function() {
            var args = arguments;
            if (retUnwrapped && !this.__chain__) {
              var value = this.value();
              return func.apply(isArray(value) ? value : [], args);
            }
            return this[chainName](function(value2) {
              return func.apply(isArray(value2) ? value2 : [], args);
            });
          };
        });
        baseForOwn(LazyWrapper.prototype, function(func, methodName) {
          var lodashFunc = lodash[methodName];
          if (lodashFunc) {
            var key = lodashFunc.name + "";
            if (!hasOwnProperty.call(realNames, key)) {
              realNames[key] = [];
            }
            realNames[key].push({ "name": methodName, "func": lodashFunc });
          }
        });
        realNames[createHybrid(undefined2, WRAP_BIND_KEY_FLAG).name] = [{
          "name": "wrapper",
          "func": undefined2
        }];
        LazyWrapper.prototype.clone = lazyClone;
        LazyWrapper.prototype.reverse = lazyReverse;
        LazyWrapper.prototype.value = lazyValue;
        lodash.prototype.at = wrapperAt;
        lodash.prototype.chain = wrapperChain;
        lodash.prototype.commit = wrapperCommit;
        lodash.prototype.next = wrapperNext;
        lodash.prototype.plant = wrapperPlant;
        lodash.prototype.reverse = wrapperReverse;
        lodash.prototype.toJSON = lodash.prototype.valueOf = lodash.prototype.value = wrapperValue;
        lodash.prototype.first = lodash.prototype.head;
        if (symIterator) {
          lodash.prototype[symIterator] = wrapperToIterator;
        }
        return lodash;
      };
      var _2 = runInContext();
      if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
        root._ = _2;
        define(function() {
          return _2;
        });
      } else if (freeModule) {
        (freeModule.exports = _2)._ = _2;
        freeExports._ = _2;
      } else {
        root._ = _2;
      }
    }).call(exports);
  }
});

// src/paper.tsx
import React3 from "react";
import {
  $ as $2,
  $$ as $$2,
  Cite,
  Ref,
  Footnote,
  Section,
  SubSection,
  Title,
  Authors,
  Author,
  Name,
  Affiliation,
  Institution,
  Abstract,
  Document,
  Wrap,
  Row,
  Listing as Listing2,
  ListingConfigure,
  Figure,
  Subfigure,
  Caption,
  Definition,
  Smallcaps
} from "nota";
import { newcommand } from "nota/dist/tex";
import { Expandable } from "nota/dist/document";
import { ToggleButton as ToggleButton2 } from "nota/dist/togglebox";
import { Theorem } from "nota/dist/math";
import { Correspondence, Link } from "nota/dist/correspondence";

// node_modules/lezer-tree/dist/tree.es.js
var DefaultBufferLength = 1024;
var nextPropID = 0;
var CachedNode = new WeakMap();
var NodeProp = class {
  constructor({ deserialize } = {}) {
    this.id = nextPropID++;
    this.deserialize = deserialize || (() => {
      throw new Error("This node type doesn't define a deserialize function");
    });
  }
  static string() {
    return new NodeProp({ deserialize: (str) => str });
  }
  static number() {
    return new NodeProp({ deserialize: Number });
  }
  static flag() {
    return new NodeProp({ deserialize: () => true });
  }
  set(propObj, value) {
    propObj[this.id] = value;
    return propObj;
  }
  add(match) {
    if (typeof match != "function")
      match = NodeType.match(match);
    return (type) => {
      let result = match(type);
      return result === void 0 ? null : [this, result];
    };
  }
};
NodeProp.closedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
NodeProp.openedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
NodeProp.group = new NodeProp({ deserialize: (str) => str.split(" ") });
var noProps = Object.create(null);
var NodeType = class {
  constructor(name, props, id, flags = 0) {
    this.name = name;
    this.props = props;
    this.id = id;
    this.flags = flags;
  }
  static define(spec) {
    let props = spec.props && spec.props.length ? Object.create(null) : noProps;
    let flags = (spec.top ? 1 : 0) | (spec.skipped ? 2 : 0) | (spec.error ? 4 : 0) | (spec.name == null ? 8 : 0);
    let type = new NodeType(spec.name || "", props, spec.id, flags);
    if (spec.props)
      for (let src of spec.props) {
        if (!Array.isArray(src))
          src = src(type);
        if (src)
          src[0].set(props, src[1]);
      }
    return type;
  }
  prop(prop) {
    return this.props[prop.id];
  }
  get isTop() {
    return (this.flags & 1) > 0;
  }
  get isSkipped() {
    return (this.flags & 2) > 0;
  }
  get isError() {
    return (this.flags & 4) > 0;
  }
  get isAnonymous() {
    return (this.flags & 8) > 0;
  }
  is(name) {
    if (typeof name == "string") {
      if (this.name == name)
        return true;
      let group = this.prop(NodeProp.group);
      return group ? group.indexOf(name) > -1 : false;
    }
    return this.id == name;
  }
  static match(map) {
    let direct = Object.create(null);
    for (let prop in map)
      for (let name of prop.split(" "))
        direct[name] = map[prop];
    return (node) => {
      for (let groups = node.prop(NodeProp.group), i = -1; i < (groups ? groups.length : 0); i++) {
        let found = direct[i < 0 ? node.name : groups[i]];
        if (found)
          return found;
      }
    };
  }
};
NodeType.none = new NodeType("", Object.create(null), 0, 8);
var NodeSet = class {
  constructor(types) {
    this.types = types;
    for (let i = 0; i < types.length; i++)
      if (types[i].id != i)
        throw new RangeError("Node type ids should correspond to array positions when creating a node set");
  }
  extend(...props) {
    let newTypes = [];
    for (let type of this.types) {
      let newProps = null;
      for (let source of props) {
        let add = source(type);
        if (add) {
          if (!newProps)
            newProps = Object.assign({}, type.props);
          add[0].set(newProps, add[1]);
        }
      }
      newTypes.push(newProps ? new NodeType(type.name, newProps, type.id, type.flags) : type);
    }
    return new NodeSet(newTypes);
  }
};
var Tree = class {
  constructor(type, children, positions, length) {
    this.type = type;
    this.children = children;
    this.positions = positions;
    this.length = length;
  }
  toString() {
    let children = this.children.map((c) => c.toString()).join();
    return !this.type.name ? children : (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (children.length ? "(" + children + ")" : "");
  }
  cursor(pos, side = 0) {
    let scope = pos != null && CachedNode.get(this) || this.topNode;
    let cursor = new TreeCursor(scope);
    if (pos != null) {
      cursor.moveTo(pos, side);
      CachedNode.set(this, cursor._tree);
    }
    return cursor;
  }
  fullCursor() {
    return new TreeCursor(this.topNode, true);
  }
  get topNode() {
    return new TreeNode(this, 0, 0, null);
  }
  resolve(pos, side = 0) {
    return this.cursor(pos, side).node;
  }
  iterate(spec) {
    let { enter, leave, from = 0, to = this.length } = spec;
    for (let c = this.cursor(); ; ) {
      let mustLeave = false;
      if (c.from <= to && c.to >= from && (c.type.isAnonymous || enter(c.type, c.from, c.to) !== false)) {
        if (c.firstChild())
          continue;
        if (!c.type.isAnonymous)
          mustLeave = true;
      }
      for (; ; ) {
        if (mustLeave && leave)
          leave(c.type, c.from, c.to);
        mustLeave = c.type.isAnonymous;
        if (c.nextSibling())
          break;
        if (!c.parent())
          return;
        mustLeave = true;
      }
    }
  }
  balance(maxBufferLength = DefaultBufferLength) {
    return this.children.length <= BalanceBranchFactor ? this : balanceRange(this.type, NodeType.none, this.children, this.positions, 0, this.children.length, 0, maxBufferLength, this.length, 0);
  }
  static build(data) {
    return buildTree(data);
  }
};
Tree.empty = new Tree(NodeType.none, [], [], 0);
function withHash(tree, hash) {
  if (hash)
    tree.contextHash = hash;
  return tree;
}
var TreeBuffer = class {
  constructor(buffer, length, set, type = NodeType.none) {
    this.buffer = buffer;
    this.length = length;
    this.set = set;
    this.type = type;
  }
  toString() {
    let result = [];
    for (let index = 0; index < this.buffer.length; ) {
      result.push(this.childString(index));
      index = this.buffer[index + 3];
    }
    return result.join(",");
  }
  childString(index) {
    let id = this.buffer[index], endIndex = this.buffer[index + 3];
    let type = this.set.types[id], result = type.name;
    if (/\W/.test(result) && !type.isError)
      result = JSON.stringify(result);
    index += 4;
    if (endIndex == index)
      return result;
    let children = [];
    while (index < endIndex) {
      children.push(this.childString(index));
      index = this.buffer[index + 3];
    }
    return result + "(" + children.join(",") + ")";
  }
  findChild(startIndex, endIndex, dir, after) {
    let { buffer } = this, pick = -1;
    for (let i = startIndex; i != endIndex; i = buffer[i + 3]) {
      if (after != -1e8) {
        let start = buffer[i + 1], end = buffer[i + 2];
        if (dir > 0) {
          if (end > after)
            pick = i;
          if (end > after)
            break;
        } else {
          if (start < after)
            pick = i;
          if (end >= after)
            break;
        }
      } else {
        pick = i;
        if (dir > 0)
          break;
      }
    }
    return pick;
  }
};
var TreeNode = class {
  constructor(node, from, index, _parent) {
    this.node = node;
    this.from = from;
    this.index = index;
    this._parent = _parent;
  }
  get type() {
    return this.node.type;
  }
  get name() {
    return this.node.type.name;
  }
  get to() {
    return this.from + this.node.length;
  }
  nextChild(i, dir, after, full = false) {
    for (let parent = this; ; ) {
      for (let { children, positions } = parent.node, e = dir > 0 ? children.length : -1; i != e; i += dir) {
        let next = children[i], start = positions[i] + parent.from;
        if (after != -1e8 && (dir < 0 ? start >= after : start + next.length <= after))
          continue;
        if (next instanceof TreeBuffer) {
          let index = next.findChild(0, next.buffer.length, dir, after == -1e8 ? -1e8 : after - start);
          if (index > -1)
            return new BufferNode(new BufferContext(parent, next, i, start), null, index);
        } else if (full || (!next.type.isAnonymous || hasChild(next))) {
          let inner = new TreeNode(next, start, i, parent);
          return full || !inner.type.isAnonymous ? inner : inner.nextChild(dir < 0 ? next.children.length - 1 : 0, dir, after);
        }
      }
      if (full || !parent.type.isAnonymous)
        return null;
      i = parent.index + dir;
      parent = parent._parent;
      if (!parent)
        return null;
    }
  }
  get firstChild() {
    return this.nextChild(0, 1, -1e8);
  }
  get lastChild() {
    return this.nextChild(this.node.children.length - 1, -1, -1e8);
  }
  childAfter(pos) {
    return this.nextChild(0, 1, pos);
  }
  childBefore(pos) {
    return this.nextChild(this.node.children.length - 1, -1, pos);
  }
  nextSignificantParent() {
    let val = this;
    while (val.type.isAnonymous && val._parent)
      val = val._parent;
    return val;
  }
  get parent() {
    return this._parent ? this._parent.nextSignificantParent() : null;
  }
  get nextSibling() {
    return this._parent ? this._parent.nextChild(this.index + 1, 1, -1) : null;
  }
  get prevSibling() {
    return this._parent ? this._parent.nextChild(this.index - 1, -1, -1) : null;
  }
  get cursor() {
    return new TreeCursor(this);
  }
  resolve(pos, side = 0) {
    return this.cursor.moveTo(pos, side).node;
  }
  getChild(type, before = null, after = null) {
    let r4 = getChildren(this, type, before, after);
    return r4.length ? r4[0] : null;
  }
  getChildren(type, before = null, after = null) {
    return getChildren(this, type, before, after);
  }
  toString() {
    return this.node.toString();
  }
};
function getChildren(node, type, before, after) {
  let cur = node.cursor, result = [];
  if (!cur.firstChild())
    return result;
  if (before != null) {
    while (!cur.type.is(before))
      if (!cur.nextSibling())
        return result;
  }
  for (; ; ) {
    if (after != null && cur.type.is(after))
      return result;
    if (cur.type.is(type))
      result.push(cur.node);
    if (!cur.nextSibling())
      return after == null ? result : [];
  }
}
var BufferContext = class {
  constructor(parent, buffer, index, start) {
    this.parent = parent;
    this.buffer = buffer;
    this.index = index;
    this.start = start;
  }
};
var BufferNode = class {
  constructor(context, _parent, index) {
    this.context = context;
    this._parent = _parent;
    this.index = index;
    this.type = context.buffer.set.types[context.buffer.buffer[index]];
  }
  get name() {
    return this.type.name;
  }
  get from() {
    return this.context.start + this.context.buffer.buffer[this.index + 1];
  }
  get to() {
    return this.context.start + this.context.buffer.buffer[this.index + 2];
  }
  child(dir, after) {
    let { buffer } = this.context;
    let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, after == -1e8 ? -1e8 : after - this.context.start);
    return index < 0 ? null : new BufferNode(this.context, this, index);
  }
  get firstChild() {
    return this.child(1, -1e8);
  }
  get lastChild() {
    return this.child(-1, -1e8);
  }
  childAfter(pos) {
    return this.child(1, pos);
  }
  childBefore(pos) {
    return this.child(-1, pos);
  }
  get parent() {
    return this._parent || this.context.parent.nextSignificantParent();
  }
  externalSibling(dir) {
    return this._parent ? null : this.context.parent.nextChild(this.context.index + dir, dir, -1);
  }
  get nextSibling() {
    let { buffer } = this.context;
    let after = buffer.buffer[this.index + 3];
    if (after < (this._parent ? buffer.buffer[this._parent.index + 3] : buffer.buffer.length))
      return new BufferNode(this.context, this._parent, after);
    return this.externalSibling(1);
  }
  get prevSibling() {
    let { buffer } = this.context;
    let parentStart = this._parent ? this._parent.index + 4 : 0;
    if (this.index == parentStart)
      return this.externalSibling(-1);
    return new BufferNode(this.context, this._parent, buffer.findChild(parentStart, this.index, -1, -1e8));
  }
  get cursor() {
    return new TreeCursor(this);
  }
  resolve(pos, side = 0) {
    return this.cursor.moveTo(pos, side).node;
  }
  toString() {
    return this.context.buffer.childString(this.index);
  }
  getChild(type, before = null, after = null) {
    let r4 = getChildren(this, type, before, after);
    return r4.length ? r4[0] : null;
  }
  getChildren(type, before = null, after = null) {
    return getChildren(this, type, before, after);
  }
};
var TreeCursor = class {
  constructor(node, full = false) {
    this.full = full;
    this.buffer = null;
    this.stack = [];
    this.index = 0;
    this.bufferNode = null;
    if (node instanceof TreeNode) {
      this.yieldNode(node);
    } else {
      this._tree = node.context.parent;
      this.buffer = node.context;
      for (let n = node._parent; n; n = n._parent)
        this.stack.unshift(n.index);
      this.bufferNode = node;
      this.yieldBuf(node.index);
    }
  }
  get name() {
    return this.type.name;
  }
  yieldNode(node) {
    if (!node)
      return false;
    this._tree = node;
    this.type = node.type;
    this.from = node.from;
    this.to = node.to;
    return true;
  }
  yieldBuf(index, type) {
    this.index = index;
    let { start, buffer } = this.buffer;
    this.type = type || buffer.set.types[buffer.buffer[index]];
    this.from = start + buffer.buffer[index + 1];
    this.to = start + buffer.buffer[index + 2];
    return true;
  }
  yield(node) {
    if (!node)
      return false;
    if (node instanceof TreeNode) {
      this.buffer = null;
      return this.yieldNode(node);
    }
    this.buffer = node.context;
    return this.yieldBuf(node.index, node.type);
  }
  toString() {
    return this.buffer ? this.buffer.buffer.childString(this.index) : this._tree.toString();
  }
  enter(dir, after) {
    if (!this.buffer)
      return this.yield(this._tree.nextChild(dir < 0 ? this._tree.node.children.length - 1 : 0, dir, after, this.full));
    let { buffer } = this.buffer;
    let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, after == -1e8 ? -1e8 : after - this.buffer.start);
    if (index < 0)
      return false;
    this.stack.push(this.index);
    return this.yieldBuf(index);
  }
  firstChild() {
    return this.enter(1, -1e8);
  }
  lastChild() {
    return this.enter(-1, -1e8);
  }
  childAfter(pos) {
    return this.enter(1, pos);
  }
  childBefore(pos) {
    return this.enter(-1, pos);
  }
  parent() {
    if (!this.buffer)
      return this.yieldNode(this.full ? this._tree._parent : this._tree.parent);
    if (this.stack.length)
      return this.yieldBuf(this.stack.pop());
    let parent = this.full ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
    this.buffer = null;
    return this.yieldNode(parent);
  }
  sibling(dir) {
    if (!this.buffer)
      return !this._tree._parent ? false : this.yield(this._tree._parent.nextChild(this._tree.index + dir, dir, -1e8, this.full));
    let { buffer } = this.buffer, d = this.stack.length - 1;
    if (dir < 0) {
      let parentStart = d < 0 ? 0 : this.stack[d] + 4;
      if (this.index != parentStart)
        return this.yieldBuf(buffer.findChild(parentStart, this.index, -1, -1e8));
    } else {
      let after = buffer.buffer[this.index + 3];
      if (after < (d < 0 ? buffer.buffer.length : buffer.buffer[this.stack[d] + 3]))
        return this.yieldBuf(after);
    }
    return d < 0 ? this.yield(this.buffer.parent.nextChild(this.buffer.index + dir, dir, -1e8, this.full)) : false;
  }
  nextSibling() {
    return this.sibling(1);
  }
  prevSibling() {
    return this.sibling(-1);
  }
  atLastNode(dir) {
    let index, parent, { buffer } = this;
    if (buffer) {
      if (dir > 0) {
        if (this.index < buffer.buffer.buffer.length)
          return false;
      } else {
        for (let i = 0; i < this.index; i++)
          if (buffer.buffer.buffer[i + 3] < this.index)
            return false;
      }
      ({ index, parent } = buffer);
    } else {
      ({ index, _parent: parent } = this._tree);
    }
    for (; parent; { index, _parent: parent } = parent) {
      for (let i = index + dir, e = dir < 0 ? -1 : parent.node.children.length; i != e; i += dir) {
        let child = parent.node.children[i];
        if (this.full || !child.type.isAnonymous || child instanceof TreeBuffer || hasChild(child))
          return false;
      }
    }
    return true;
  }
  move(dir) {
    if (this.enter(dir, -1e8))
      return true;
    for (; ; ) {
      if (this.sibling(dir))
        return true;
      if (this.atLastNode(dir) || !this.parent())
        return false;
    }
  }
  next() {
    return this.move(1);
  }
  prev() {
    return this.move(-1);
  }
  moveTo(pos, side = 0) {
    while (this.from == this.to || (side < 1 ? this.from >= pos : this.from > pos) || (side > -1 ? this.to <= pos : this.to < pos))
      if (!this.parent())
        break;
    for (; ; ) {
      if (side < 0 ? !this.childBefore(pos) : !this.childAfter(pos))
        break;
      if (this.from == this.to || (side < 1 ? this.from >= pos : this.from > pos) || (side > -1 ? this.to <= pos : this.to < pos)) {
        this.parent();
        break;
      }
    }
    return this;
  }
  get node() {
    if (!this.buffer)
      return this._tree;
    let cache = this.bufferNode, result = null, depth = 0;
    if (cache && cache.context == this.buffer) {
      scan:
        for (let index = this.index, d = this.stack.length; d >= 0; ) {
          for (let c = cache; c; c = c._parent)
            if (c.index == index) {
              if (index == this.index)
                return c;
              result = c;
              depth = d + 1;
              break scan;
            }
          index = this.stack[--d];
        }
    }
    for (let i = depth; i < this.stack.length; i++)
      result = new BufferNode(this.buffer, result, this.stack[i]);
    return this.bufferNode = new BufferNode(this.buffer, result, this.index);
  }
  get tree() {
    return this.buffer ? null : this._tree.node;
  }
};
function hasChild(tree) {
  return tree.children.some((ch) => !ch.type.isAnonymous || ch instanceof TreeBuffer || hasChild(ch));
}
var FlatBufferCursor = class {
  constructor(buffer, index) {
    this.buffer = buffer;
    this.index = index;
  }
  get id() {
    return this.buffer[this.index - 4];
  }
  get start() {
    return this.buffer[this.index - 3];
  }
  get end() {
    return this.buffer[this.index - 2];
  }
  get size() {
    return this.buffer[this.index - 1];
  }
  get pos() {
    return this.index;
  }
  next() {
    this.index -= 4;
  }
  fork() {
    return new FlatBufferCursor(this.buffer, this.index);
  }
};
var BalanceBranchFactor = 8;
function buildTree(data) {
  var _a;
  let { buffer, nodeSet, topID = 0, maxBufferLength = DefaultBufferLength, reused = [], minRepeatType = nodeSet.types.length } = data;
  let cursor = Array.isArray(buffer) ? new FlatBufferCursor(buffer, buffer.length) : buffer;
  let types = nodeSet.types;
  let contextHash = 0;
  function takeNode(parentStart, minPos, children2, positions2, inRepeat) {
    let { id, start, end, size } = cursor;
    let startPos = start - parentStart;
    if (size < 0) {
      if (size == -1) {
        children2.push(reused[id]);
        positions2.push(startPos);
      } else {
        contextHash = id;
      }
      cursor.next();
      return;
    }
    let type = types[id], node, buffer2;
    if (end - start <= maxBufferLength && (buffer2 = findBufferSize(cursor.pos - minPos, inRepeat))) {
      let data2 = new Uint16Array(buffer2.size - buffer2.skip);
      let endPos = cursor.pos - buffer2.size, index = data2.length;
      while (cursor.pos > endPos)
        index = copyToBuffer(buffer2.start, data2, index, inRepeat);
      node = new TreeBuffer(data2, end - buffer2.start, nodeSet, inRepeat < 0 ? NodeType.none : types[inRepeat]);
      startPos = buffer2.start - parentStart;
    } else {
      let endPos = cursor.pos - size;
      cursor.next();
      let localChildren = [], localPositions = [];
      let localInRepeat = id >= minRepeatType ? id : -1;
      while (cursor.pos > endPos) {
        if (cursor.id == localInRepeat)
          cursor.next();
        else
          takeNode(start, endPos, localChildren, localPositions, localInRepeat);
      }
      localChildren.reverse();
      localPositions.reverse();
      if (localInRepeat > -1 && localChildren.length > BalanceBranchFactor)
        node = balanceRange(type, type, localChildren, localPositions, 0, localChildren.length, 0, maxBufferLength, end - start, contextHash);
      else
        node = withHash(new Tree(type, localChildren, localPositions, end - start), contextHash);
    }
    children2.push(node);
    positions2.push(startPos);
  }
  function findBufferSize(maxSize, inRepeat) {
    let fork = cursor.fork();
    let size = 0, start = 0, skip = 0, minStart = fork.end - maxBufferLength;
    let result = { size: 0, start: 0, skip: 0 };
    scan:
      for (let minPos = fork.pos - maxSize; fork.pos > minPos; ) {
        if (fork.id == inRepeat) {
          result.size = size;
          result.start = start;
          result.skip = skip;
          skip += 4;
          size += 4;
          fork.next();
          continue;
        }
        let nodeSize = fork.size, startPos = fork.pos - nodeSize;
        if (nodeSize < 0 || startPos < minPos || fork.start < minStart)
          break;
        let localSkipped = fork.id >= minRepeatType ? 4 : 0;
        let nodeStart = fork.start;
        fork.next();
        while (fork.pos > startPos) {
          if (fork.size < 0)
            break scan;
          if (fork.id >= minRepeatType)
            localSkipped += 4;
          fork.next();
        }
        start = nodeStart;
        size += nodeSize;
        skip += localSkipped;
      }
    if (inRepeat < 0 || size == maxSize) {
      result.size = size;
      result.start = start;
      result.skip = skip;
    }
    return result.size > 4 ? result : void 0;
  }
  function copyToBuffer(bufferStart, buffer2, index, inRepeat) {
    let { id, start, end, size } = cursor;
    cursor.next();
    if (id == inRepeat)
      return index;
    let startIndex = index;
    if (size > 4) {
      let endPos = cursor.pos - (size - 4);
      while (cursor.pos > endPos)
        index = copyToBuffer(bufferStart, buffer2, index, inRepeat);
    }
    if (id < minRepeatType) {
      buffer2[--index] = startIndex;
      buffer2[--index] = end - bufferStart;
      buffer2[--index] = start - bufferStart;
      buffer2[--index] = id;
    }
    return index;
  }
  let children = [], positions = [];
  while (cursor.pos > 0)
    takeNode(data.start || 0, 0, children, positions, -1);
  let length = (_a = data.length) !== null && _a !== void 0 ? _a : children.length ? positions[0] + children[0].length : 0;
  return new Tree(types[topID], children.reverse(), positions.reverse(), length);
}
function balanceRange(outerType, innerType, children, positions, from, to, start, maxBufferLength, length, contextHash) {
  let localChildren = [], localPositions = [];
  if (length <= maxBufferLength) {
    for (let i = from; i < to; i++) {
      localChildren.push(children[i]);
      localPositions.push(positions[i] - start);
    }
  } else {
    let maxChild = Math.max(maxBufferLength, Math.ceil(length * 1.5 / BalanceBranchFactor));
    for (let i = from; i < to; ) {
      let groupFrom = i, groupStart = positions[i];
      i++;
      for (; i < to; i++) {
        let nextEnd = positions[i] + children[i].length;
        if (nextEnd - groupStart > maxChild)
          break;
      }
      if (i == groupFrom + 1) {
        let only = children[groupFrom];
        if (only instanceof Tree && only.type == innerType && only.length > maxChild << 1) {
          for (let j = 0; j < only.children.length; j++) {
            localChildren.push(only.children[j]);
            localPositions.push(only.positions[j] + groupStart - start);
          }
          continue;
        }
        localChildren.push(only);
      } else if (i == groupFrom + 1) {
        localChildren.push(children[groupFrom]);
      } else {
        let inner = balanceRange(innerType, innerType, children, positions, groupFrom, i, groupStart, maxBufferLength, positions[i - 1] + children[i - 1].length - groupStart, contextHash);
        if (innerType != NodeType.none && !containsType(inner.children, innerType))
          inner = withHash(new Tree(NodeType.none, inner.children, inner.positions, inner.length), contextHash);
        localChildren.push(inner);
      }
      localPositions.push(groupStart - start);
    }
  }
  return withHash(new Tree(outerType, localChildren, localPositions, length), contextHash);
}
function containsType(nodes, type) {
  for (let elt of nodes)
    if (elt.type == type)
      return true;
  return false;
}
function stringInput(input) {
  return new StringInput(input);
}
var StringInput = class {
  constructor(string, length = string.length) {
    this.string = string;
    this.length = length;
  }
  get(pos) {
    return pos < 0 || pos >= this.length ? -1 : this.string.charCodeAt(pos);
  }
  lineAfter(pos) {
    if (pos < 0)
      return "";
    let end = this.string.indexOf("\n", pos);
    return this.string.slice(pos, end < 0 ? this.length : Math.min(end, this.length));
  }
  read(from, to) {
    return this.string.slice(from, Math.min(this.length, to));
  }
  clip(at) {
    return new StringInput(this.string, at);
  }
};

// node_modules/lezer/dist/index.es.js
var Stack = class {
  constructor(p, stack, state, reducePos, pos, score, buffer, bufferBase, curContext, parent) {
    this.p = p;
    this.stack = stack;
    this.state = state;
    this.reducePos = reducePos;
    this.pos = pos;
    this.score = score;
    this.buffer = buffer;
    this.bufferBase = bufferBase;
    this.curContext = curContext;
    this.parent = parent;
  }
  toString() {
    return `[${this.stack.filter((_2, i) => i % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
  }
  static start(p, state, pos = 0) {
    let cx = p.parser.context;
    return new Stack(p, [], state, pos, pos, 0, [], 0, cx ? new StackContext(cx, cx.start) : null, null);
  }
  get context() {
    return this.curContext ? this.curContext.context : null;
  }
  pushState(state, start) {
    this.stack.push(this.state, start, this.bufferBase + this.buffer.length);
    this.state = state;
  }
  reduce(action) {
    let depth = action >> 19, type = action & 65535;
    let { parser: parser2 } = this.p;
    let dPrec = parser2.dynamicPrecedence(type);
    if (dPrec)
      this.score += dPrec;
    if (depth == 0) {
      if (type < parser2.minRepeatTerm)
        this.storeNode(type, this.reducePos, this.reducePos, 4, true);
      this.pushState(parser2.getGoto(this.state, type, true), this.reducePos);
      this.reduceContext(type);
      return;
    }
    let base = this.stack.length - (depth - 1) * 3 - (action & 262144 ? 6 : 0);
    let start = this.stack[base - 2];
    let bufferBase = this.stack[base - 1], count = this.bufferBase + this.buffer.length - bufferBase;
    if (type < parser2.minRepeatTerm || action & 131072) {
      let pos = parser2.stateFlag(this.state, 1) ? this.pos : this.reducePos;
      this.storeNode(type, start, pos, count + 4, true);
    }
    if (action & 262144) {
      this.state = this.stack[base];
    } else {
      let baseStateID = this.stack[base - 3];
      this.state = parser2.getGoto(baseStateID, type, true);
    }
    while (this.stack.length > base)
      this.stack.pop();
    this.reduceContext(type);
  }
  storeNode(term, start, end, size = 4, isReduce = false) {
    if (term == 0) {
      let cur = this, top = this.buffer.length;
      if (top == 0 && cur.parent) {
        top = cur.bufferBase - cur.parent.bufferBase;
        cur = cur.parent;
      }
      if (top > 0 && cur.buffer[top - 4] == 0 && cur.buffer[top - 1] > -1) {
        if (start == end)
          return;
        if (cur.buffer[top - 2] >= start) {
          cur.buffer[top - 2] = end;
          return;
        }
      }
    }
    if (!isReduce || this.pos == end) {
      this.buffer.push(term, start, end, size);
    } else {
      let index = this.buffer.length;
      if (index > 0 && this.buffer[index - 4] != 0)
        while (index > 0 && this.buffer[index - 2] > end) {
          this.buffer[index] = this.buffer[index - 4];
          this.buffer[index + 1] = this.buffer[index - 3];
          this.buffer[index + 2] = this.buffer[index - 2];
          this.buffer[index + 3] = this.buffer[index - 1];
          index -= 4;
          if (size > 4)
            size -= 4;
        }
      this.buffer[index] = term;
      this.buffer[index + 1] = start;
      this.buffer[index + 2] = end;
      this.buffer[index + 3] = size;
    }
  }
  shift(action, next, nextEnd) {
    if (action & 131072) {
      this.pushState(action & 65535, this.pos);
    } else if ((action & 262144) == 0) {
      let start = this.pos, nextState = action, { parser: parser2 } = this.p;
      if (nextEnd > this.pos || next <= parser2.maxNode) {
        this.pos = nextEnd;
        if (!parser2.stateFlag(nextState, 1))
          this.reducePos = nextEnd;
      }
      this.pushState(nextState, start);
      if (next <= parser2.maxNode)
        this.buffer.push(next, start, nextEnd, 4);
      this.shiftContext(next);
    } else {
      if (next <= this.p.parser.maxNode)
        this.buffer.push(next, this.pos, nextEnd, 4);
      this.pos = nextEnd;
    }
  }
  apply(action, next, nextEnd) {
    if (action & 65536)
      this.reduce(action);
    else
      this.shift(action, next, nextEnd);
  }
  useNode(value, next) {
    let index = this.p.reused.length - 1;
    if (index < 0 || this.p.reused[index] != value) {
      this.p.reused.push(value);
      index++;
    }
    let start = this.pos;
    this.reducePos = this.pos = start + value.length;
    this.pushState(next, start);
    this.buffer.push(index, start, this.reducePos, -1);
    if (this.curContext)
      this.updateContext(this.curContext.tracker.reuse(this.curContext.context, value, this.p.input, this));
  }
  split() {
    let parent = this;
    let off = parent.buffer.length;
    while (off > 0 && parent.buffer[off - 2] > parent.reducePos)
      off -= 4;
    let buffer = parent.buffer.slice(off), base = parent.bufferBase + off;
    while (parent && base == parent.bufferBase)
      parent = parent.parent;
    return new Stack(this.p, this.stack.slice(), this.state, this.reducePos, this.pos, this.score, buffer, base, this.curContext, parent);
  }
  recoverByDelete(next, nextEnd) {
    let isNode = next <= this.p.parser.maxNode;
    if (isNode)
      this.storeNode(next, this.pos, nextEnd);
    this.storeNode(0, this.pos, nextEnd, isNode ? 8 : 4);
    this.pos = this.reducePos = nextEnd;
    this.score -= 200;
  }
  canShift(term) {
    for (let sim = new SimulatedStack(this); ; ) {
      let action = this.p.parser.stateSlot(sim.top, 4) || this.p.parser.hasAction(sim.top, term);
      if ((action & 65536) == 0)
        return true;
      if (action == 0)
        return false;
      sim.reduce(action);
    }
  }
  get ruleStart() {
    for (let state = this.state, base = this.stack.length; ; ) {
      let force = this.p.parser.stateSlot(state, 5);
      if (!(force & 65536))
        return 0;
      base -= 3 * (force >> 19);
      if ((force & 65535) < this.p.parser.minRepeatTerm)
        return this.stack[base + 1];
      state = this.stack[base];
    }
  }
  startOf(types, before) {
    let state = this.state, frame = this.stack.length, { parser: parser2 } = this.p;
    for (; ; ) {
      let force = parser2.stateSlot(state, 5);
      let depth = force >> 19, term = force & 65535;
      if (types.indexOf(term) > -1) {
        let base = frame - 3 * (force >> 19), pos = this.stack[base + 1];
        if (before == null || before > pos)
          return pos;
      }
      if (frame == 0)
        return null;
      if (depth == 0) {
        frame -= 3;
        state = this.stack[frame];
      } else {
        frame -= 3 * (depth - 1);
        state = parser2.getGoto(this.stack[frame - 3], term, true);
      }
    }
  }
  recoverByInsert(next) {
    if (this.stack.length >= 300)
      return [];
    let nextStates = this.p.parser.nextStates(this.state);
    if (nextStates.length > 4 << 1 || this.stack.length >= 120) {
      let best = [];
      for (let i = 0, s; i < nextStates.length; i += 2) {
        if ((s = nextStates[i + 1]) != this.state && this.p.parser.hasAction(s, next))
          best.push(nextStates[i], s);
      }
      if (this.stack.length < 120)
        for (let i = 0; best.length < 4 << 1 && i < nextStates.length; i += 2) {
          let s = nextStates[i + 1];
          if (!best.some((v, i2) => i2 & 1 && v == s))
            best.push(nextStates[i], s);
        }
      nextStates = best;
    }
    let result = [];
    for (let i = 0; i < nextStates.length && result.length < 4; i += 2) {
      let s = nextStates[i + 1];
      if (s == this.state)
        continue;
      let stack = this.split();
      stack.storeNode(0, stack.pos, stack.pos, 4, true);
      stack.pushState(s, this.pos);
      stack.shiftContext(nextStates[i]);
      stack.score -= 200;
      result.push(stack);
    }
    return result;
  }
  forceReduce() {
    let reduce = this.p.parser.stateSlot(this.state, 5);
    if ((reduce & 65536) == 0)
      return false;
    if (!this.p.parser.validAction(this.state, reduce)) {
      this.storeNode(0, this.reducePos, this.reducePos, 4, true);
      this.score -= 100;
    }
    this.reduce(reduce);
    return true;
  }
  forceAll() {
    while (!this.p.parser.stateFlag(this.state, 2) && this.forceReduce()) {
    }
    return this;
  }
  get deadEnd() {
    if (this.stack.length != 3)
      return false;
    let { parser: parser2 } = this.p;
    return parser2.data[parser2.stateSlot(this.state, 1)] == 65535 && !parser2.stateSlot(this.state, 4);
  }
  restart() {
    this.state = this.stack[0];
    this.stack.length = 0;
  }
  sameState(other) {
    if (this.state != other.state || this.stack.length != other.stack.length)
      return false;
    for (let i = 0; i < this.stack.length; i += 3)
      if (this.stack[i] != other.stack[i])
        return false;
    return true;
  }
  get parser() {
    return this.p.parser;
  }
  dialectEnabled(dialectID) {
    return this.p.parser.dialect.flags[dialectID];
  }
  shiftContext(term) {
    if (this.curContext)
      this.updateContext(this.curContext.tracker.shift(this.curContext.context, term, this.p.input, this));
  }
  reduceContext(term) {
    if (this.curContext)
      this.updateContext(this.curContext.tracker.reduce(this.curContext.context, term, this.p.input, this));
  }
  emitContext() {
    let cx = this.curContext;
    if (!cx.tracker.strict)
      return;
    let last = this.buffer.length - 1;
    if (last < 0 || this.buffer[last] != -2)
      this.buffer.push(cx.hash, this.reducePos, this.reducePos, -2);
  }
  updateContext(context) {
    if (context != this.curContext.context) {
      let newCx = new StackContext(this.curContext.tracker, context);
      if (newCx.hash != this.curContext.hash)
        this.emitContext();
      this.curContext = newCx;
    }
  }
};
var StackContext = class {
  constructor(tracker, context) {
    this.tracker = tracker;
    this.context = context;
    this.hash = tracker.hash(context);
  }
};
var Recover;
(function(Recover2) {
  Recover2[Recover2["Token"] = 200] = "Token";
  Recover2[Recover2["Reduce"] = 100] = "Reduce";
  Recover2[Recover2["MaxNext"] = 4] = "MaxNext";
  Recover2[Recover2["MaxInsertStackDepth"] = 300] = "MaxInsertStackDepth";
  Recover2[Recover2["DampenInsertStackDepth"] = 120] = "DampenInsertStackDepth";
})(Recover || (Recover = {}));
var SimulatedStack = class {
  constructor(stack) {
    this.stack = stack;
    this.top = stack.state;
    this.rest = stack.stack;
    this.offset = this.rest.length;
  }
  reduce(action) {
    let term = action & 65535, depth = action >> 19;
    if (depth == 0) {
      if (this.rest == this.stack.stack)
        this.rest = this.rest.slice();
      this.rest.push(this.top, 0, 0);
      this.offset += 3;
    } else {
      this.offset -= (depth - 1) * 3;
    }
    let goto = this.stack.p.parser.getGoto(this.rest[this.offset - 3], term, true);
    this.top = goto;
  }
};
var StackBufferCursor = class {
  constructor(stack, pos, index) {
    this.stack = stack;
    this.pos = pos;
    this.index = index;
    this.buffer = stack.buffer;
    if (this.index == 0)
      this.maybeNext();
  }
  static create(stack) {
    return new StackBufferCursor(stack, stack.bufferBase + stack.buffer.length, stack.buffer.length);
  }
  maybeNext() {
    let next = this.stack.parent;
    if (next != null) {
      this.index = this.stack.bufferBase - next.bufferBase;
      this.stack = next;
      this.buffer = next.buffer;
    }
  }
  get id() {
    return this.buffer[this.index - 4];
  }
  get start() {
    return this.buffer[this.index - 3];
  }
  get end() {
    return this.buffer[this.index - 2];
  }
  get size() {
    return this.buffer[this.index - 1];
  }
  next() {
    this.index -= 4;
    this.pos -= 4;
    if (this.index == 0)
      this.maybeNext();
  }
  fork() {
    return new StackBufferCursor(this.stack, this.pos, this.index);
  }
};
var Token = class {
  constructor() {
    this.start = -1;
    this.value = -1;
    this.end = -1;
  }
  accept(value, end) {
    this.value = value;
    this.end = end;
  }
};
var TokenGroup = class {
  constructor(data, id) {
    this.data = data;
    this.id = id;
  }
  token(input, token, stack) {
    readToken(this.data, input, token, stack, this.id);
  }
};
TokenGroup.prototype.contextual = TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
var ExternalTokenizer = class {
  constructor(token, options = {}) {
    this.token = token;
    this.contextual = !!options.contextual;
    this.fallback = !!options.fallback;
    this.extend = !!options.extend;
  }
};
function readToken(data, input, token, stack, group) {
  let state = 0, groupMask = 1 << group, dialect = stack.p.parser.dialect;
  scan:
    for (let pos = token.start; ; ) {
      if ((groupMask & data[state]) == 0)
        break;
      let accEnd = data[state + 1];
      for (let i = state + 3; i < accEnd; i += 2)
        if ((data[i + 1] & groupMask) > 0) {
          let term = data[i];
          if (dialect.allows(term) && (token.value == -1 || token.value == term || stack.p.parser.overrides(term, token.value))) {
            token.accept(term, pos);
            break;
          }
        }
      let next = input.get(pos++);
      for (let low = 0, high = data[state + 2]; low < high; ) {
        let mid = low + high >> 1;
        let index = accEnd + mid + (mid << 1);
        let from = data[index], to = data[index + 1];
        if (next < from)
          high = mid;
        else if (next >= to)
          low = mid + 1;
        else {
          state = data[index + 2];
          continue scan;
        }
      }
      break;
    }
}
function decodeArray(input, Type = Uint16Array) {
  if (typeof input != "string")
    return input;
  let array = null;
  for (let pos = 0, out = 0; pos < input.length; ) {
    let value = 0;
    for (; ; ) {
      let next = input.charCodeAt(pos++), stop = false;
      if (next == 126) {
        value = 65535;
        break;
      }
      if (next >= 92)
        next--;
      if (next >= 34)
        next--;
      let digit = next - 32;
      if (digit >= 46) {
        digit -= 46;
        stop = true;
      }
      value += digit;
      if (stop)
        break;
      value *= 46;
    }
    if (array)
      array[out++] = value;
    else
      array = new Type(value);
  }
  return array;
}
var verbose = typeof process != "undefined" && /\bparse\b/.test(process.env.LOG);
var stackIDs = null;
function cutAt(tree, pos, side) {
  let cursor = tree.cursor(pos);
  for (; ; ) {
    if (!(side < 0 ? cursor.childBefore(pos) : cursor.childAfter(pos)))
      for (; ; ) {
        if ((side < 0 ? cursor.to < pos : cursor.from > pos) && !cursor.type.isError)
          return side < 0 ? Math.max(0, Math.min(cursor.to - 1, pos - 5)) : Math.min(tree.length, Math.max(cursor.from + 1, pos + 5));
        if (side < 0 ? cursor.prevSibling() : cursor.nextSibling())
          break;
        if (!cursor.parent())
          return side < 0 ? 0 : tree.length;
      }
  }
}
var FragmentCursor = class {
  constructor(fragments) {
    this.fragments = fragments;
    this.i = 0;
    this.fragment = null;
    this.safeFrom = -1;
    this.safeTo = -1;
    this.trees = [];
    this.start = [];
    this.index = [];
    this.nextFragment();
  }
  nextFragment() {
    let fr = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
    if (fr) {
      this.safeFrom = fr.openStart ? cutAt(fr.tree, fr.from + fr.offset, 1) - fr.offset : fr.from;
      this.safeTo = fr.openEnd ? cutAt(fr.tree, fr.to + fr.offset, -1) - fr.offset : fr.to;
      while (this.trees.length) {
        this.trees.pop();
        this.start.pop();
        this.index.pop();
      }
      this.trees.push(fr.tree);
      this.start.push(-fr.offset);
      this.index.push(0);
      this.nextStart = this.safeFrom;
    } else {
      this.nextStart = 1e9;
    }
  }
  nodeAt(pos) {
    if (pos < this.nextStart)
      return null;
    while (this.fragment && this.safeTo <= pos)
      this.nextFragment();
    if (!this.fragment)
      return null;
    for (; ; ) {
      let last = this.trees.length - 1;
      if (last < 0) {
        this.nextFragment();
        return null;
      }
      let top = this.trees[last], index = this.index[last];
      if (index == top.children.length) {
        this.trees.pop();
        this.start.pop();
        this.index.pop();
        continue;
      }
      let next = top.children[index];
      let start = this.start[last] + top.positions[index];
      if (start > pos) {
        this.nextStart = start;
        return null;
      } else if (start == pos && start + next.length <= this.safeTo) {
        return start == pos && start >= this.safeFrom ? next : null;
      }
      if (next instanceof TreeBuffer) {
        this.index[last]++;
        this.nextStart = start + next.length;
      } else {
        this.index[last]++;
        if (start + next.length >= pos) {
          this.trees.push(next);
          this.start.push(start);
          this.index.push(0);
        }
      }
    }
  }
};
var CachedToken = class extends Token {
  constructor() {
    super(...arguments);
    this.extended = -1;
    this.mask = 0;
    this.context = 0;
  }
  clear(start) {
    this.start = start;
    this.value = this.extended = -1;
  }
};
var dummyToken = new Token();
var TokenCache = class {
  constructor(parser2) {
    this.tokens = [];
    this.mainToken = dummyToken;
    this.actions = [];
    this.tokens = parser2.tokenizers.map((_2) => new CachedToken());
  }
  getActions(stack, input) {
    let actionIndex = 0;
    let main = null;
    let { parser: parser2 } = stack.p, { tokenizers } = parser2;
    let mask = parser2.stateSlot(stack.state, 3);
    let context = stack.curContext ? stack.curContext.hash : 0;
    for (let i = 0; i < tokenizers.length; i++) {
      if ((1 << i & mask) == 0)
        continue;
      let tokenizer = tokenizers[i], token = this.tokens[i];
      if (main && !tokenizer.fallback)
        continue;
      if (tokenizer.contextual || token.start != stack.pos || token.mask != mask || token.context != context) {
        this.updateCachedToken(token, tokenizer, stack, input);
        token.mask = mask;
        token.context = context;
      }
      if (token.value != 0) {
        let startIndex = actionIndex;
        if (token.extended > -1)
          actionIndex = this.addActions(stack, token.extended, token.end, actionIndex);
        actionIndex = this.addActions(stack, token.value, token.end, actionIndex);
        if (!tokenizer.extend) {
          main = token;
          if (actionIndex > startIndex)
            break;
        }
      }
    }
    while (this.actions.length > actionIndex)
      this.actions.pop();
    if (!main) {
      main = dummyToken;
      main.start = stack.pos;
      if (stack.pos == input.length)
        main.accept(stack.p.parser.eofTerm, stack.pos);
      else
        main.accept(0, stack.pos + 1);
    }
    this.mainToken = main;
    return this.actions;
  }
  updateCachedToken(token, tokenizer, stack, input) {
    token.clear(stack.pos);
    tokenizer.token(input, token, stack);
    if (token.value > -1) {
      let { parser: parser2 } = stack.p;
      for (let i = 0; i < parser2.specialized.length; i++)
        if (parser2.specialized[i] == token.value) {
          let result = parser2.specializers[i](input.read(token.start, token.end), stack);
          if (result >= 0 && stack.p.parser.dialect.allows(result >> 1)) {
            if ((result & 1) == 0)
              token.value = result >> 1;
            else
              token.extended = result >> 1;
            break;
          }
        }
    } else if (stack.pos == input.length) {
      token.accept(stack.p.parser.eofTerm, stack.pos);
    } else {
      token.accept(0, stack.pos + 1);
    }
  }
  putAction(action, token, end, index) {
    for (let i = 0; i < index; i += 3)
      if (this.actions[i] == action)
        return index;
    this.actions[index++] = action;
    this.actions[index++] = token;
    this.actions[index++] = end;
    return index;
  }
  addActions(stack, token, end, index) {
    let { state } = stack, { parser: parser2 } = stack.p, { data } = parser2;
    for (let set = 0; set < 2; set++) {
      for (let i = parser2.stateSlot(state, set ? 2 : 1); ; i += 3) {
        if (data[i] == 65535) {
          if (data[i + 1] == 1) {
            i = pair(data, i + 2);
          } else {
            if (index == 0 && data[i + 1] == 2)
              index = this.putAction(pair(data, i + 1), token, end, index);
            break;
          }
        }
        if (data[i] == token)
          index = this.putAction(pair(data, i + 1), token, end, index);
      }
    }
    return index;
  }
};
var Rec;
(function(Rec2) {
  Rec2[Rec2["Distance"] = 5] = "Distance";
  Rec2[Rec2["MaxRemainingPerStep"] = 3] = "MaxRemainingPerStep";
  Rec2[Rec2["MinBufferLengthPrune"] = 200] = "MinBufferLengthPrune";
  Rec2[Rec2["ForceReduceLimit"] = 10] = "ForceReduceLimit";
})(Rec || (Rec = {}));
var Parse = class {
  constructor(parser2, input, startPos, context) {
    this.parser = parser2;
    this.input = input;
    this.startPos = startPos;
    this.context = context;
    this.pos = 0;
    this.recovering = 0;
    this.nextStackID = 9812;
    this.nested = null;
    this.nestEnd = 0;
    this.nestWrap = null;
    this.reused = [];
    this.tokens = new TokenCache(parser2);
    this.topTerm = parser2.top[1];
    this.stacks = [Stack.start(this, parser2.top[0], this.startPos)];
    let fragments = context === null || context === void 0 ? void 0 : context.fragments;
    this.fragments = fragments && fragments.length ? new FragmentCursor(fragments) : null;
  }
  advance() {
    if (this.nested) {
      let result = this.nested.advance();
      this.pos = this.nested.pos;
      if (result) {
        this.finishNested(this.stacks[0], result);
        this.nested = null;
      }
      return null;
    }
    let stacks = this.stacks, pos = this.pos;
    let newStacks = this.stacks = [];
    let stopped, stoppedTokens;
    let maybeNest;
    for (let i = 0; i < stacks.length; i++) {
      let stack = stacks[i], nest;
      for (; ; ) {
        if (stack.pos > pos) {
          newStacks.push(stack);
        } else if (nest = this.checkNest(stack)) {
          if (!maybeNest || maybeNest.stack.score < stack.score)
            maybeNest = nest;
        } else if (this.advanceStack(stack, newStacks, stacks)) {
          continue;
        } else {
          if (!stopped) {
            stopped = [];
            stoppedTokens = [];
          }
          stopped.push(stack);
          let tok = this.tokens.mainToken;
          stoppedTokens.push(tok.value, tok.end);
        }
        break;
      }
    }
    if (maybeNest) {
      this.startNested(maybeNest);
      return null;
    }
    if (!newStacks.length) {
      let finished = stopped && findFinished(stopped);
      if (finished)
        return this.stackToTree(finished);
      if (this.parser.strict) {
        if (verbose && stopped)
          console.log("Stuck with token " + this.parser.getName(this.tokens.mainToken.value));
        throw new SyntaxError("No parse at " + pos);
      }
      if (!this.recovering)
        this.recovering = 5;
    }
    if (this.recovering && stopped) {
      let finished = this.runRecovery(stopped, stoppedTokens, newStacks);
      if (finished)
        return this.stackToTree(finished.forceAll());
    }
    if (this.recovering) {
      let maxRemaining = this.recovering == 1 ? 1 : this.recovering * 3;
      if (newStacks.length > maxRemaining) {
        newStacks.sort((a, b) => b.score - a.score);
        while (newStacks.length > maxRemaining)
          newStacks.pop();
      }
      if (newStacks.some((s) => s.reducePos > pos))
        this.recovering--;
    } else if (newStacks.length > 1) {
      outer:
        for (let i = 0; i < newStacks.length - 1; i++) {
          let stack = newStacks[i];
          for (let j = i + 1; j < newStacks.length; j++) {
            let other = newStacks[j];
            if (stack.sameState(other) || stack.buffer.length > 200 && other.buffer.length > 200) {
              if ((stack.score - other.score || stack.buffer.length - other.buffer.length) > 0) {
                newStacks.splice(j--, 1);
              } else {
                newStacks.splice(i--, 1);
                continue outer;
              }
            }
          }
        }
    }
    this.pos = newStacks[0].pos;
    for (let i = 1; i < newStacks.length; i++)
      if (newStacks[i].pos < this.pos)
        this.pos = newStacks[i].pos;
    return null;
  }
  advanceStack(stack, stacks, split) {
    let start = stack.pos, { input, parser: parser2 } = this;
    let base = verbose ? this.stackID(stack) + " -> " : "";
    if (this.fragments) {
      let strictCx = stack.curContext && stack.curContext.tracker.strict, cxHash = strictCx ? stack.curContext.hash : 0;
      for (let cached = this.fragments.nodeAt(start); cached; ) {
        let match = this.parser.nodeSet.types[cached.type.id] == cached.type ? parser2.getGoto(stack.state, cached.type.id) : -1;
        if (match > -1 && cached.length && (!strictCx || (cached.contextHash || 0) == cxHash)) {
          stack.useNode(cached, match);
          if (verbose)
            console.log(base + this.stackID(stack) + ` (via reuse of ${parser2.getName(cached.type.id)})`);
          return true;
        }
        if (!(cached instanceof Tree) || cached.children.length == 0 || cached.positions[0] > 0)
          break;
        let inner = cached.children[0];
        if (inner instanceof Tree)
          cached = inner;
        else
          break;
      }
    }
    let defaultReduce = parser2.stateSlot(stack.state, 4);
    if (defaultReduce > 0) {
      stack.reduce(defaultReduce);
      if (verbose)
        console.log(base + this.stackID(stack) + ` (via always-reduce ${parser2.getName(defaultReduce & 65535)})`);
      return true;
    }
    let actions = this.tokens.getActions(stack, input);
    for (let i = 0; i < actions.length; ) {
      let action = actions[i++], term = actions[i++], end = actions[i++];
      let last = i == actions.length || !split;
      let localStack = last ? stack : stack.split();
      localStack.apply(action, term, end);
      if (verbose)
        console.log(base + this.stackID(localStack) + ` (via ${(action & 65536) == 0 ? "shift" : `reduce of ${parser2.getName(action & 65535)}`} for ${parser2.getName(term)} @ ${start}${localStack == stack ? "" : ", split"})`);
      if (last)
        return true;
      else if (localStack.pos > start)
        stacks.push(localStack);
      else
        split.push(localStack);
    }
    return false;
  }
  advanceFully(stack, newStacks) {
    let pos = stack.pos;
    for (; ; ) {
      let nest = this.checkNest(stack);
      if (nest)
        return nest;
      if (!this.advanceStack(stack, null, null))
        return false;
      if (stack.pos > pos) {
        pushStackDedup(stack, newStacks);
        return true;
      }
    }
  }
  runRecovery(stacks, tokens, newStacks) {
    let finished = null, restarted = false;
    let maybeNest;
    for (let i = 0; i < stacks.length; i++) {
      let stack = stacks[i], token = tokens[i << 1], tokenEnd = tokens[(i << 1) + 1];
      let base = verbose ? this.stackID(stack) + " -> " : "";
      if (stack.deadEnd) {
        if (restarted)
          continue;
        restarted = true;
        stack.restart();
        if (verbose)
          console.log(base + this.stackID(stack) + " (restarted)");
        let done = this.advanceFully(stack, newStacks);
        if (done) {
          if (done !== true)
            maybeNest = done;
          continue;
        }
      }
      let force = stack.split(), forceBase = base;
      for (let j = 0; force.forceReduce() && j < 10; j++) {
        if (verbose)
          console.log(forceBase + this.stackID(force) + " (via force-reduce)");
        let done = this.advanceFully(force, newStacks);
        if (done) {
          if (done !== true)
            maybeNest = done;
          break;
        }
        if (verbose)
          forceBase = this.stackID(force) + " -> ";
      }
      for (let insert of stack.recoverByInsert(token)) {
        if (verbose)
          console.log(base + this.stackID(insert) + " (via recover-insert)");
        this.advanceFully(insert, newStacks);
      }
      if (this.input.length > stack.pos) {
        if (tokenEnd == stack.pos) {
          tokenEnd++;
          token = 0;
        }
        stack.recoverByDelete(token, tokenEnd);
        if (verbose)
          console.log(base + this.stackID(stack) + ` (via recover-delete ${this.parser.getName(token)})`);
        pushStackDedup(stack, newStacks);
      } else if (!finished || finished.score < stack.score) {
        finished = stack;
      }
    }
    if (finished)
      return finished;
    if (maybeNest) {
      for (let s of this.stacks)
        if (s.score > maybeNest.stack.score) {
          maybeNest = void 0;
          break;
        }
    }
    if (maybeNest)
      this.startNested(maybeNest);
    return null;
  }
  forceFinish() {
    let stack = this.stacks[0].split();
    if (this.nested)
      this.finishNested(stack, this.nested.forceFinish());
    return this.stackToTree(stack.forceAll());
  }
  stackToTree(stack, pos = stack.pos) {
    if (this.parser.context)
      stack.emitContext();
    return Tree.build({
      buffer: StackBufferCursor.create(stack),
      nodeSet: this.parser.nodeSet,
      topID: this.topTerm,
      maxBufferLength: this.parser.bufferLength,
      reused: this.reused,
      start: this.startPos,
      length: pos - this.startPos,
      minRepeatType: this.parser.minRepeatTerm
    });
  }
  checkNest(stack) {
    let info = this.parser.findNested(stack.state);
    if (!info)
      return null;
    let spec = info.value;
    if (typeof spec == "function")
      spec = spec(this.input, stack);
    return spec ? { stack, info, spec } : null;
  }
  startNested(nest) {
    let { stack, info, spec } = nest;
    this.stacks = [stack];
    this.nestEnd = this.scanForNestEnd(stack, info.end, spec.filterEnd);
    this.nestWrap = typeof spec.wrapType == "number" ? this.parser.nodeSet.types[spec.wrapType] : spec.wrapType || null;
    if (spec.startParse) {
      this.nested = spec.startParse(this.input.clip(this.nestEnd), stack.pos, this.context);
    } else {
      this.finishNested(stack);
    }
  }
  scanForNestEnd(stack, endToken, filter) {
    for (let pos = stack.pos; pos < this.input.length; pos++) {
      dummyToken.start = pos;
      dummyToken.value = -1;
      endToken.token(this.input, dummyToken, stack);
      if (dummyToken.value > -1 && (!filter || filter(this.input.read(pos, dummyToken.end))))
        return pos;
    }
    return this.input.length;
  }
  finishNested(stack, tree) {
    if (this.nestWrap)
      tree = new Tree(this.nestWrap, tree ? [tree] : [], tree ? [0] : [], this.nestEnd - stack.pos);
    else if (!tree)
      tree = new Tree(NodeType.none, [], [], this.nestEnd - stack.pos);
    let info = this.parser.findNested(stack.state);
    stack.useNode(tree, this.parser.getGoto(stack.state, info.placeholder, true));
    if (verbose)
      console.log(this.stackID(stack) + ` (via unnest)`);
  }
  stackID(stack) {
    let id = (stackIDs || (stackIDs = new WeakMap())).get(stack);
    if (!id)
      stackIDs.set(stack, id = String.fromCodePoint(this.nextStackID++));
    return id + stack;
  }
};
function pushStackDedup(stack, newStacks) {
  for (let i = 0; i < newStacks.length; i++) {
    let other = newStacks[i];
    if (other.pos == stack.pos && other.sameState(stack)) {
      if (newStacks[i].score < stack.score)
        newStacks[i] = stack;
      return;
    }
  }
  newStacks.push(stack);
}
var Dialect = class {
  constructor(source, flags, disabled) {
    this.source = source;
    this.flags = flags;
    this.disabled = disabled;
  }
  allows(term) {
    return !this.disabled || this.disabled[term] == 0;
  }
};
var Parser = class {
  constructor(spec) {
    this.bufferLength = DefaultBufferLength;
    this.strict = false;
    this.cachedDialect = null;
    if (spec.version != 13)
      throw new RangeError(`Parser version (${spec.version}) doesn't match runtime version (${13})`);
    let tokenArray = decodeArray(spec.tokenData);
    let nodeNames = spec.nodeNames.split(" ");
    this.minRepeatTerm = nodeNames.length;
    this.context = spec.context;
    for (let i = 0; i < spec.repeatNodeCount; i++)
      nodeNames.push("");
    let nodeProps = [];
    for (let i = 0; i < nodeNames.length; i++)
      nodeProps.push([]);
    function setProp(nodeID, prop, value) {
      nodeProps[nodeID].push([prop, prop.deserialize(String(value))]);
    }
    if (spec.nodeProps)
      for (let propSpec of spec.nodeProps) {
        let prop = propSpec[0];
        for (let i = 1; i < propSpec.length; ) {
          let next = propSpec[i++];
          if (next >= 0) {
            setProp(next, prop, propSpec[i++]);
          } else {
            let value = propSpec[i + -next];
            for (let j = -next; j > 0; j--)
              setProp(propSpec[i++], prop, value);
            i++;
          }
        }
      }
    this.specialized = new Uint16Array(spec.specialized ? spec.specialized.length : 0);
    this.specializers = [];
    if (spec.specialized)
      for (let i = 0; i < spec.specialized.length; i++) {
        this.specialized[i] = spec.specialized[i].term;
        this.specializers[i] = spec.specialized[i].get;
      }
    this.states = decodeArray(spec.states, Uint32Array);
    this.data = decodeArray(spec.stateData);
    this.goto = decodeArray(spec.goto);
    let topTerms = Object.keys(spec.topRules).map((r4) => spec.topRules[r4][1]);
    this.nodeSet = new NodeSet(nodeNames.map((name, i) => NodeType.define({
      name: i >= this.minRepeatTerm ? void 0 : name,
      id: i,
      props: nodeProps[i],
      top: topTerms.indexOf(i) > -1,
      error: i == 0,
      skipped: spec.skippedNodes && spec.skippedNodes.indexOf(i) > -1
    })));
    this.maxTerm = spec.maxTerm;
    this.tokenizers = spec.tokenizers.map((value) => typeof value == "number" ? new TokenGroup(tokenArray, value) : value);
    this.topRules = spec.topRules;
    this.nested = (spec.nested || []).map(([name, value, endToken, placeholder]) => {
      return { name, value, end: new TokenGroup(decodeArray(endToken), 0), placeholder };
    });
    this.dialects = spec.dialects || {};
    this.dynamicPrecedences = spec.dynamicPrecedences || null;
    this.tokenPrecTable = spec.tokenPrec;
    this.termNames = spec.termNames || null;
    this.maxNode = this.nodeSet.types.length - 1;
    this.dialect = this.parseDialect();
    this.top = this.topRules[Object.keys(this.topRules)[0]];
  }
  parse(input, startPos = 0, context = {}) {
    if (typeof input == "string")
      input = stringInput(input);
    let cx = new Parse(this, input, startPos, context);
    for (; ; ) {
      let done = cx.advance();
      if (done)
        return done;
    }
  }
  startParse(input, startPos = 0, context = {}) {
    if (typeof input == "string")
      input = stringInput(input);
    return new Parse(this, input, startPos, context);
  }
  getGoto(state, term, loose = false) {
    let table = this.goto;
    if (term >= table[0])
      return -1;
    for (let pos = table[term + 1]; ; ) {
      let groupTag = table[pos++], last = groupTag & 1;
      let target = table[pos++];
      if (last && loose)
        return target;
      for (let end = pos + (groupTag >> 1); pos < end; pos++)
        if (table[pos] == state)
          return target;
      if (last)
        return -1;
    }
  }
  hasAction(state, terminal) {
    let data = this.data;
    for (let set = 0; set < 2; set++) {
      for (let i = this.stateSlot(state, set ? 2 : 1), next; ; i += 3) {
        if ((next = data[i]) == 65535) {
          if (data[i + 1] == 1)
            next = data[i = pair(data, i + 2)];
          else if (data[i + 1] == 2)
            return pair(data, i + 2);
          else
            break;
        }
        if (next == terminal || next == 0)
          return pair(data, i + 1);
      }
    }
    return 0;
  }
  stateSlot(state, slot) {
    return this.states[state * 6 + slot];
  }
  stateFlag(state, flag) {
    return (this.stateSlot(state, 0) & flag) > 0;
  }
  findNested(state) {
    let flags = this.stateSlot(state, 0);
    return flags & 4 ? this.nested[flags >> 10] : null;
  }
  validAction(state, action) {
    if (action == this.stateSlot(state, 4))
      return true;
    for (let i = this.stateSlot(state, 1); ; i += 3) {
      if (this.data[i] == 65535) {
        if (this.data[i + 1] == 1)
          i = pair(this.data, i + 2);
        else
          return false;
      }
      if (action == pair(this.data, i + 1))
        return true;
    }
  }
  nextStates(state) {
    let result = [];
    for (let i = this.stateSlot(state, 1); ; i += 3) {
      if (this.data[i] == 65535) {
        if (this.data[i + 1] == 1)
          i = pair(this.data, i + 2);
        else
          break;
      }
      if ((this.data[i + 2] & 65536 >> 16) == 0) {
        let value = this.data[i + 1];
        if (!result.some((v, i2) => i2 & 1 && v == value))
          result.push(this.data[i], value);
      }
    }
    return result;
  }
  overrides(token, prev) {
    let iPrev = findOffset(this.data, this.tokenPrecTable, prev);
    return iPrev < 0 || findOffset(this.data, this.tokenPrecTable, token) < iPrev;
  }
  configure(config) {
    let copy = Object.assign(Object.create(Parser.prototype), this);
    if (config.props)
      copy.nodeSet = this.nodeSet.extend(...config.props);
    if (config.top) {
      let info = this.topRules[config.top];
      if (!info)
        throw new RangeError(`Invalid top rule name ${config.top}`);
      copy.top = info;
    }
    if (config.tokenizers)
      copy.tokenizers = this.tokenizers.map((t) => {
        let found = config.tokenizers.find((r4) => r4.from == t);
        return found ? found.to : t;
      });
    if (config.dialect)
      copy.dialect = this.parseDialect(config.dialect);
    if (config.nested)
      copy.nested = this.nested.map((obj) => {
        if (!Object.prototype.hasOwnProperty.call(config.nested, obj.name))
          return obj;
        return { name: obj.name, value: config.nested[obj.name], end: obj.end, placeholder: obj.placeholder };
      });
    if (config.strict != null)
      copy.strict = config.strict;
    if (config.bufferLength != null)
      copy.bufferLength = config.bufferLength;
    return copy;
  }
  getName(term) {
    return this.termNames ? this.termNames[term] : String(term <= this.maxNode && this.nodeSet.types[term].name || term);
  }
  get eofTerm() {
    return this.maxNode + 1;
  }
  get hasNested() {
    return this.nested.length > 0;
  }
  get topNode() {
    return this.nodeSet.types[this.top[1]];
  }
  dynamicPrecedence(term) {
    let prec = this.dynamicPrecedences;
    return prec == null ? 0 : prec[term] || 0;
  }
  parseDialect(dialect) {
    if (this.cachedDialect && this.cachedDialect.source == dialect)
      return this.cachedDialect;
    let values = Object.keys(this.dialects), flags = values.map(() => false);
    if (dialect)
      for (let part of dialect.split(" ")) {
        let id = values.indexOf(part);
        if (id >= 0)
          flags[id] = true;
      }
    let disabled = null;
    for (let i = 0; i < values.length; i++)
      if (!flags[i]) {
        for (let j = this.dialects[values[i]], id; (id = this.data[j++]) != 65535; )
          (disabled || (disabled = new Uint8Array(this.maxTerm + 1)))[id] = 1;
      }
    return this.cachedDialect = new Dialect(dialect, flags, disabled);
  }
  static deserialize(spec) {
    return new Parser(spec);
  }
};
function pair(data, off) {
  return data[off] | data[off + 1] << 16;
}
function findOffset(data, start, term) {
  for (let i = start, next; (next = data[i]) != 65535; i++)
    if (next == term)
      return i - start;
  return -1;
}
function findFinished(stacks) {
  let best = null;
  for (let stack of stacks) {
    if (stack.pos == stack.p.input.length && stack.p.parser.stateFlag(stack.state, 2) && (!best || best.score < stack.score))
      best = stack;
  }
  return best;
}

// node_modules/lezer-rust/dist/index.es.js
var closureParamDelim = 1;
var tpOpen = 2;
var tpClose = 3;
var RawString = 4;
var Float = 5;
var _b = 98;
var _e = 101;
var _f = 102;
var _r = 114;
var _E = 69;
var Dot = 46;
var Plus = 43;
var Minus = 45;
var Hash = 35;
var Quote = 34;
var Pipe = 124;
var LessThan = 60;
var GreaterThan = 62;
function isNum(ch) {
  return ch >= 48 && ch <= 57;
}
function isNum_(ch) {
  return isNum(ch) || ch == 95;
}
var literalTokens = new ExternalTokenizer((input, token, stack) => {
  let pos = token.start, next = input.get(pos);
  if (isNum(next)) {
    let isFloat = false;
    do {
      next = input.get(++pos);
    } while (isNum_(next));
    if (next == Dot) {
      isFloat = true;
      next = input.get(++pos);
      if (isNum(next)) {
        do {
          next = input.get(++pos);
        } while (isNum_(next));
      } else if (next == Dot || next > 127 || /\w/.test(String.fromCharCode(next))) {
        return;
      }
    }
    if (next == _e || next == _E) {
      isFloat = true;
      next = input.get(++pos);
      if (next == Plus || next == Minus)
        next = input.get(++pos);
      let startNum = pos;
      while (isNum_(next))
        next = input.get(++pos);
      if (pos == startNum)
        return;
    }
    if (next == _f) {
      if (!/32|64/.test(input.read(pos + 1, pos + 3)))
        return;
      isFloat = true;
      pos += 3;
    }
    if (isFloat)
      token.accept(Float, pos);
  } else if (next == _b || next == _r) {
    if (next == _b)
      next = input.get(++pos);
    if (next != _r)
      return;
    next = input.get(++pos);
    let count = 0;
    while (next == Hash) {
      count++;
      next = input.get(++pos);
    }
    if (next != Quote)
      return;
    next = input.get(++pos);
    content:
      for (; ; ) {
        if (next < 0)
          return;
        let isQuote = next == Quote;
        next = input.get(++pos);
        if (isQuote) {
          for (let i = 0; i < count; i++) {
            if (next != Hash)
              continue content;
            next = input.get(++pos);
          }
          token.accept(RawString, pos);
          return;
        }
      }
  }
});
var closureParam = new ExternalTokenizer((input, token) => {
  if (input.get(token.start) == Pipe)
    token.accept(closureParamDelim, token.start + 1);
});
var tpDelim = new ExternalTokenizer((input, token) => {
  let pos = token.start, next = input.get(pos);
  if (next == LessThan)
    token.accept(tpOpen, pos + 1);
  else if (next == GreaterThan)
    token.accept(tpClose, pos + 1);
});
var spec_identifier = { __proto__: null, self: 28, super: 32, crate: 34, impl: 46, true: 72, false: 72, pub: 88, in: 92, const: 96, unsafe: 104, async: 108, move: 110, if: 114, let: 118, ref: 142, mut: 144, _: 198, else: 200, match: 204, as: 248, return: 252, await: 262, break: 270, continue: 276, while: 312, loop: 316, for: 320, macro_rules: 327, mod: 334, extern: 342, struct: 346, where: 364, union: 379, enum: 382, type: 390, default: 395, fn: 396, trait: 412, use: 420, static: 438, dyn: 476 };
var parser = Parser.deserialize({
  version: 13,
  states: "$3tQ]Q_OOP$wOWOOO&sQWO'#CnO)WQWO'#IaOOQP'#Ia'#IaOOQQ'#If'#IfO)hO`O'#C}OOQR'#Ii'#IiO)sQWO'#IvOOQO'#Hk'#HkO)xQWO'#DpOOQR'#Ix'#IxO)xQWO'#DpO*ZQWO'#DpOOQO'#Iw'#IwO,SQWO'#J`O,ZQWO'#EiOOQV'#Hp'#HpO,cQYO'#F{OOQV'#El'#ElOOQV'#Em'#EmOOQV'#En'#EnO.YQ_O'#EkO0_Q_O'#EoO2gQWOOO4QQ_O'#FPO7hQWO'#J`OOQV'#FY'#FYO7{Q_O'#F^O:WQ_O'#FaOOQO'#F`'#F`O=sQ_O'#FcO=}Q_O'#FbO@VQWO'#FgOOQO'#J`'#J`OOQV'#Ip'#IpOA]Q_O'#IoOEPQWO'#IoOOQV'#Fw'#FwOF[QWO'#JuOFcQWO'#F|OOQO'#IO'#IOOGrQWO'#GhOOQV'#In'#InOOQV'#Im'#ImOOQV'#Hj'#HjQGyQ_OOOKeQ_O'#DUOKlQYO'#CqOOQP'#I`'#I`OOQV'#Hg'#HgQ]Q_OOOLuQWO'#IaONsQYO'#DXO!!eQWO'#JuO!!lQWO'#JuO!!vQ_O'#DfO!%]Q_O'#E}O!(sQ_O'#FWO!,ZQWO'#FZO!.^QXO'#FbO!.cQ_O'#EeO!!vQ_O'#FmO!0uQWO'#FoO!0zQWO'#FoO!1PQ^O'#FqO!1WQWO'#JuO!1_QWO'#FtO!1dQWO'#FxO!2WQWO'#JjO!2_QWO'#GOO!2_QWO'#G`O!2_QWO'#GbO!2_QWO'#GsOOQO'#Ju'#JuO!2dQWO'#GhO!2lQYO'#GpO!2_QWO'#GqO!3uQ^O'#GtO!3|QWO'#GuO!4hQWO'#HOP!4sOpO'#CcPOOO)CDO)CDOOOOO'#Hi'#HiO!5OO`O,59iOOQV,59i,59iO!5ZQYO,5?bOOQO-E;i-E;iOOQO,5:[,5:[OOQP,59Z,59ZO)xQWO,5:[O)xQWO,5:[O!5oQWO,5?lO!5zQYO,5;qO!6PQYO,5;TO!6hQWO,59QO!7kQXO'#CnO!7rQXO'#IaO!8vQWO'#CoO,^QWO'#EiOOQV-E;n-E;nO!9XQWO'#FsOOQV,5<g,5<gO!8vQWO'#CoO!9^QWO'#CoO!9cQWO'#IaO! yQWO'#JuO!9mQWO'#J`O!:TQWO,5;VOOQO'#Io'#IoO!0zQWO'#DaO!<TQWO'#DcO!<]QWO,5;ZO.YQ_O,5;ZOOQO,5;[,5;[OOQV'#Er'#ErOOQV'#Es'#EsOOQV'#Et'#EtOOQV'#Eu'#EuOOQV'#Ev'#EvOOQV'#Ew'#EwOOQV'#Ex'#ExOOQV'#Ey'#EyO.YQ_O,5;]O.YQ_O,5;]O.YQ_O,5;]O.YQ_O,5;]O.YQ_O,5;]O.YQ_O,5;]O.YQ_O,5;]O.YQ_O,5;]O.YQ_O,5;]O.YQ_O,5;fO!<sQ_O,5;kO!@ZQ_O'#FROOQO,5;l,5;lO!BfQWO,5;pO.YQ_O,5;wOKlQYO,5;gO!DRQWO,5;kO!DrQWO,5;xOOQO,5;x,5;xO!EPQWO,5;xO!EUQ_O,5;xO!GaQWO'#CfO!GfQWO,5<QO!GpQ_O,5<QOOQO,5;{,5;{O!J^QXO'#CnO!KoQXO'#IaOOQS'#Dk'#DkOOQP'#Is'#IsO!LiQ[O'#IsO!LqQXO'#DjO!MoQWO'#DnO!MoQWO'#DnO!NQQWO'#DnOOQP'#Iu'#IuO!NVQXO'#IuO# QQ^O'#DoO# [QWO'#DrO# dQ^O'#DzO# nQ^O'#D|O# uQWO'#EPO#!QQXO'#FdOOQP'#ES'#ESOOQP'#Ir'#IrO#!`QXO'#JfOOQP'#Je'#JeO#!hQXO,5;}O#!mQXO'#IaO!1PQ^O'#DyO!1PQ^O'#FdO##gQWO,5;|OOQO,5;|,5;|OKlQYO,5;|O##}QWO'#FhOOQO,5<R,5<ROOQV,5=l,5=lO#&SQYO'#FzOOQV,5<h,5<hO#&ZQWO,5<hO#&bQWO,5=SO!1WQWO,59rO!1dQWO,5<dO#&iQWO,5=iO!2_QWO,5<jO!2_QWO,5<zO!2_QWO,5<|O!2_QWO,5=QO#&pQWO,5=]O#&wQWO,5=SO!2_QWO,5=]O!3|QWO,5=aO#'PQWO,5=jOOQO-E;|-E;|O#'[QWO'#JjOOQV-E;h-E;hO#'sQWO'#HRO#'zQ_O,59pOOQV,59p,59pO#(RQWO,59pO#(WQ_O,59pO#(vQZO'#CuO#+OQZO'#CvOOQV'#C|'#C|O#-kQWO'#HTO#-rQYO'#IeOOQO'#Hh'#HhO#-zQWO'#CwO#-zQWO'#CwO#.]QWO'#CwOOQR'#Id'#IdO#.bQZO'#IcO#0wQYO'#HTO#1eQYO'#H[O#2qQYO'#H_OKlQYO'#H`OOQR'#Hb'#HbO#3}QWO'#HeO#4SQYO,59]OOQR'#Ic'#IcO#4sQZO'#CtO#7OQYO'#HUO#7TQWO'#HTO#7YQYO'#CrO#7yQWO'#H]O#7YQYO'#HcOOQV-E;e-E;eO#8RQWO,59sOOQV,59{,59{O#8aQYO,5=[OOQV,59},59}O!0zQWO,59}O#;TQWO'#IqOOQO'#Iq'#IqO!1PQ^O'#DhO!0zQWO,5:QO#;[QWO,5;iO#;rQWO,5;rO#<YQ_O,5;rOOQO,5;u,5;uO#?sQ_O,5;|O#A{QWO,5;PO!0zQWO,5<XO#BSQWO,5<ZOOQV,5<Z,5<ZO#B_QWO,5<]O!1PQ^O'#EOOOQQ'#D_'#D_O#BgQWO,59rO#BlQWO,5<`O#BqQWO,5<dOOQO,5@U,5@UO#ByQWO,5=iOOQQ'#Cv'#CvO#COQYO,5<jO#CaQYO,5<zO#ClQYO,5<|O#CwQYO,5=_O#DVQYO,5=SO#EoQYO'#GQO#E|QYO,5=[O#FaQWO,5=[O#FoQYO,5=[O#GxQYO,5=]O#HWQWO,5=`O!1PQ^O,5=`O#HfQWO'#CnO#HwQWO'#IaOOQO'#Jy'#JyO#IYQWO'#IQO#I_QWO'#GwOOQO'#Jz'#JzO#IvQWO'#GzOOQO'#G|'#G|OOQO'#Jx'#JxO#I_QWO'#GwO#I}QWO'#GxO#JSQWO,5=aO#JXQWO,5=jO!1dQWO,5=jO#'SQWO,5=jPOOO'#Hf'#HfP#J^OpO,58}POOO,58},58}OOOO-E;g-E;gOOQV1G/T1G/TO#JiQWO1G4|O#JnQ^O'#CyPOQQ'#Cx'#CxOOQO1G/v1G/vOOQP1G.u1G.uO)xQWO1G/vO#MwQ!fO'#EUO#NOQ!fO'#EVO#NVQ!fO'#ETO$ _QWO1G5WO$!RQ_O1G5WOOQO1G1]1G1]O$%uQWO1G0oO$%zQWO'#CiO!7rQXO'#IaO!6PQYO1G.lO!5oQWO,5<_O!8vQWO,59ZO!8vQWO,59ZO!5oQWO,5?lO$&]QWO1G0uO$(jQWO1G0wO$*bQWO1G0wO$*xQWO1G0wO$,|QWO1G0wO$-TQWO1G0wO$/UQWO1G0wO$/]QWO1G0wO$1^QWO1G0wO$1eQWO1G0wO$2|QWO1G1QO$4}QWO1G1VO$5nQ_O'#JcO$7vQWO'#JcOOQO'#Jb'#JbO$8QQWO,5;mOOQO'#Dw'#DwOOQO1G1[1G1[OOQO1G1Y1G1YO$8VQWO1G1cOOQO1G1R1G1RO$8^Q_O'#HrO$:lQWO,5@OO.YQ_O1G1dOOQO1G1d1G1dO$:tQWO1G1dO$;RQWO1G1dO$;WQWO1G1eOOQO1G1l1G1lO$;`QWO1G1lOOQP,5?_,5?_O$;jQ^O,5:kO$<TQXO,5:YO!MoQWO,5:YO!MoQWO,5:YO!1PQ^O,5:gO$=UQWO'#IzOOQO'#Iy'#IyO$=dQWO,5:ZO# QQ^O,5:ZO$=iQWO'#DsOOQP,5:^,5:^O$=zQWO,5:fOOQP,5:h,5:hO!1PQ^O,5:hO!1PQ^O,5:mO$>PQYO,5<OO$>ZQ_O'#HsO$>hQXO,5@QOOQV1G1i1G1iOOQP,5:e,5:eO$>pQXO,5<OO$?OQWO1G1hO$?WQWO'#CnO$?cQWO'#FiOOQO'#Fi'#FiO$?kQWO'#FjO.YQ_O'#FkOOQO'#Ji'#JiO$?pQWO'#JhOOQO'#Jg'#JgO$?xQWO,5<SOOQQ'#Hv'#HvO$?}QYO,5<fOOQV,5<f,5<fO$@UQYO,5<fOOQV1G2S1G2SO$@]QWO1G2nO$@eQWO1G/^O$@jQWO1G2OO#ByQWO1G3TO$@rQYO1G2UO#CaQYO1G2fO#ClQYO1G2hO$ATQYO1G2lO!2_QWO1G2wO#DVQYO1G2nO#GxQYO1G2wO$A]QWO1G2{O$AbQWO1G3UO!1dQWO1G3UO$AgQWO1G3UOOQV1G/[1G/[O$AoQWO1G/[O$AtQ_O1G/[O#7TQWO,5=oO$A{QYO,5?PO$BaQWO,5?PO$BfQZO'#IfOOQO-E;f-E;fOOQR,59c,59cO#-zQWO,59cO#-zQWO,59cOOQR,5=n,5=nO$ERQYO'#HVO$FkQZO,5=oO!5oQWO,5={O$H}QWO,5=oO$IUQZO,5=vO$KeQYO,5=vO$>PQYO,5=vO$KuQWO'#KRO$LQQWO,5=xOOQR,5=y,5=yO$LVQWO,5=zO$>PQYO,5>PO$>PQYO,5>POOQO1G.w1G.wO$>PQYO1G.wO$LbQYO,5=pO$LjQZO,59^OOQR,59^,59^O$>PQYO,5=wO$N|QZO,5=}OOQR,5=},5=}O%#`QWO1G/_O!6PQYO1G/_O#E|QYO1G2vO%#eQWO1G2vO%#sQYO1G2vOOQV1G/i1G/iO%$|QWO,5:SO%%UQ_O1G/lO%*_QWO1G1^O%*uQWO1G1hOOQO1G1h1G1hO$>PQYO1G1hO%+]Q^O'#EgOOQV1G0k1G0kOOQV1G1s1G1sO!!vQ_O1G1sO!0zQWO1G1uO!1PQ^O1G1wO!.cQ_O1G1wOOQP,5:j,5:jO$>PQYO1G/^OOQO'#Cn'#CnO%+jQWO1G1zOOQV1G2O1G2OO%+rQWO'#CnO%+zQWO1G3TO%,PQWO1G3TO%,UQYO'#GQO%,gQWO'#G]O%,xQYO'#G_O%.[QYO'#GXOOQV1G2U1G2UO%/kQWO1G2UO%/pQWO1G2UO$@uQWO1G2UOOQV1G2f1G2fO%/kQWO1G2fO#CdQWO1G2fO%/xQWO'#GdOOQV1G2h1G2hO%0ZQWO1G2hO#CoQWO1G2hO%0`QYO'#GSO$>PQYO1G2lO$AWQWO1G2lOOQV1G2y1G2yO%1lQWO1G2yO%3[Q^O'#GkO%3fQWO1G2nO#DYQWO1G2nO%3tQYO,5<lO%4OQYO,5<lO%4^QYO,5<lO%4{QYO,5<lOOQQ,5<l,5<lO!1WQWO'#JuO%5WQYO,5<lO%5`QWO1G2vOOQV1G2v1G2vO%5hQWO1G2vO$>PQYO1G2vOOQV1G2w1G2wO%5hQWO1G2wO%5mQWO1G2wO#G{QWO1G2wOOQV1G2z1G2zO.YQ_O1G2zO$>PQYO1G2zO%5uQWO1G2zOOQO,5>l,5>lOOQO-E<O-E<OOOQO,5=c,5=cOOQO,5=e,5=eOOQO,5=g,5=gOOQO,5=h,5=hO%6TQWO'#J|OOQO'#J{'#J{O%6]QWO,5=fO%6bQWO,5=cO!1dQWO,5=dOOQV1G2{1G2{O$>PQYO1G3UPOOO-E;d-E;dPOOO1G.i1G.iOOQO7+*h7+*hO%6yQYO'#IdO%7bQYO'#IgO%7mQYO'#IgO%7uQYO'#IgO%8QQYO,59eOOQO7+%b7+%bOOQP7+$a7+$aOOQV,5:p,5:pO%8VQ!fO,5:pO%8^Q!fO'#JTOOQS'#EZ'#EZOOQS'#E['#E[OOQS'#E]'#E]OOQS'#JT'#JTO%;PQWO'#EYOOQS'#Eb'#EbOOQS'#JR'#JROOQS'#Hn'#HnOOQV,5:q,5:qO%;UQ!fO,5:qO%;]Q!fO,5:oOOQV,5:o,5:oOOQV7+'e7+'eOOQV7+&Z7+&ZO%;dQ[O,59TO%;xQ^O,59TO%<cQWO7+$WO%<hQWO1G1yOOQV1G1y1G1yO!8vQWO1G.uOOQP1G5W1G5WO%<mQWO,5?}O%<wQ_O'#HqO%?SQWO,5?}OOQO1G1X1G1XOOQO7+&}7+&}O%?[QWO,5>^OOQO-E;p-E;pO%?iQWO7+'OO%?pQ_O7+'OOOQO7+'O7+'OOOQO7+'P7+'PO%ArQWO7+'POOQO7+'W7+'WOOQP1G0V1G0VO%AzQXO1G/tO!MoQWO1G/tO%B{QXO1G0RO%CsQ^O'#HlO%DTQWO,5?fOOQP1G/u1G/uO%D`QWO1G/uO%DeQWO'#D_OOQO'#Dt'#DtO%DpQWO'#DtO%DuQWO'#I|OOQO'#I{'#I{O%D}QWO,5:_O%ESQWO'#DtO%EXQWO'#DtOOQP1G0Q1G0QOOQP1G0S1G0SOOQP1G0X1G0XO%EaQXO1G1jO%ElQXO'#FeOOQP,5>_,5>_O!1PQ^O'#FeOOQP-E;q-E;qO$>PQYO1G1jOOQO7+'S7+'SOOQO,5<T,5<TO%EzQWO,5<UO%?pQ_O,5<UO%FPQWO,5<VO%FZQWO'#HtO%FlQWO,5@SOOQO1G1n1G1nOOQQ-E;t-E;tOOQV1G2Q1G2QO%FtQYO1G2QO#DVQYO7+(YO$>PQYO7+$xOOQV7+'j7+'jO%F{QWO7+(oO%GQQWO7+(oOOQV7+'p7+'pO%/kQWO7+'pO%GVQWO7+'pO%G_QWO7+'pOOQV7+(Q7+(QO%/kQWO7+(QO#CdQWO7+(QOOQV7+(S7+(SO%0ZQWO7+(SO#CoQWO7+(SO$>PQYO7+(WO%GmQWO7+(WO#GxQYO7+(cO%GrQWO7+(YO#DYQWO7+(YOOQV7+(c7+(cO%5hQWO7+(cO%5mQWO7+(cO#G{QWO7+(cOOQV7+(g7+(gO$>PQYO7+(pO%HQQWO7+(pO!1dQWO7+(pOOQV7+$v7+$vO%HVQWO7+$vO%H[QZO1G3ZO%JnQWO1G4kOOQO1G4k1G4kOOQR1G.}1G.}O#-zQWO1G.}O%JsQWO'#KQOOQO'#HW'#HWO%KUQWO'#HXO%KaQWO'#KQOOQO'#KP'#KPO%KiQWO,5=qO%KnQYO'#H[O%LzQWO'#GmO%MVQYO'#CtO%MaQWO'#GmO$>PQYO1G3ZOOQR1G3g1G3gO#7TQWO1G3ZO%MfQZO1G3bO$>PQYO1G3bO& uQYO'#IVO&!VQWO,5@mOOQR1G3d1G3dOOQR1G3f1G3fO%?pQ_O1G3fOOQR1G3k1G3kO&!_QYO7+$cO&!gQYO'#KOOOQQ'#J}'#J}O&!oQYO1G3[O&!tQZO1G3cOOQQ7+$y7+$yO&%TQWO7+$yO&%YQWO7+(bOOQV7+(b7+(bO%5hQWO7+(bO$>PQYO7+(bO#E|QYO7+(bO&%bQWO7+(bO!.cQ_O1G/nO&%pQWO7+%WO$?OQWO7+'SO&%xQWO'#EhO&&TQ^O'#EhOOQU'#Ho'#HoO&&TQ^O,5;ROOQV,5;R,5;RO&&_QWO,5;RO&&dQ^O,5;RO!0zQWO7+'_OOQV7+'a7+'aO&&qQWO7+'cO&&yQWO7+'cO&'QQWO7+$xO&)uQ!fO7+'fO&)|Q!fO7+'fOOQV7+(o7+(oO!1dQWO7+(oO&*TQYO,5<lO&*`QYO,5<lO!1dQWO'#GWO&*nQWO'#JpO&*|QWO'#G^O!BlQWO'#G^O&+RQWO'#JpOOQO'#Jo'#JoO&+ZQWO,5<wOOQO'#DX'#DXO&+`QYO'#JrO&,oQWO'#JrO$>PQYO'#JrOOQO'#Jq'#JqO&,zQWO,5<yO&-PQWO'#GZO#DQQWO'#G[O&-XQWO'#G[O&-aQWO'#JmOOQO'#Jl'#JlO&-lQYO'#GTOOQO,5<s,5<sO&-qQWO7+'pO&-vQWO'#JtO&.UQWO'#GeO#BlQWO'#GeO&.gQWO'#JtOOQO'#Js'#JsO&.oQWO,5=OO$>PQYO'#GUO&.tQYO'#JkOOQQ,5<n,5<nO&/]QWO7+(WOOQV7+(e7+(eO&/eQ^O'#D|O&0kQWO'#GlO&0sQ^O'#JwOOQO'#Gn'#GnO&0zQWO'#JwOOQO'#Jv'#JvO&1SQWO,5=VO&1XQWO'#IaO&1iQ^O'#GmO&2lQWO'#IrO&2zQWO'#GmOOQV7+(Y7+(YO&3SQWO7+(YO$>PQYO7+(YO&3[QYO'#HxO&3pQYO1G2WOOQQ1G2W1G2WOOQQ,5<m,5<mO$>PQYO,5<qO&3xQWO,5<rO&3}QWO7+(bO&4YQWO7+(fO&4aQWO7+(fOOQV7+(f7+(fO%?pQ_O7+(fO$>PQYO7+(fO&4lQWO'#IRO&4vQWO,5@hOOQO1G3Q1G3QOOQO1G2}1G2}OOQO1G3P1G3POOQO1G3R1G3ROOQO1G3S1G3SOOQO1G3O1G3OO&5OQWO7+(pO$>PQYO,59fO&5ZQ^O'#ISO&6QQYO,5?ROOQR1G/P1G/POOQV1G0[1G0[OOQS-E;l-E;lO&6YQ!bO,5:rO&6_Q!fO,5:tOOQV1G0]1G0]OOQV1G0Z1G0ZOOQO1G.o1G.oO&6fQWO'#KTOOQO'#KS'#KSO&6nQWO1G.oOOQV<<Gr<<GrO&6sQWO1G5iO&6{Q_O,5>]O&9QQWO,5>]OOQO-E;o-E;oOOQO<<Jj<<JjO&9[QWO<<JjOOQO<<Jk<<JkO&9cQXO7+%`O&:dQWO,5>WOOQO-E;j-E;jOOQP7+%a7+%aO!1PQ^O,5:`O&:rQWO'#HmO&;WQWO,5?hOOQP1G/y1G/yOOQO,5:`,5:`O&;`QWO,5:`O%ESQWO,5:`O$>PQYO,5<PO&;eQXO,5<PO&;sQXO7+'UO%?pQ_O1G1pO&<OQWO1G1pOOQO,5>`,5>`OOQO-E;r-E;rOOQV7+'l7+'lO&<YQWO<<KtO#DYQWO<<KtO&<hQWO<<HdOOQV<<LZ<<LZO!1dQWO<<LZOOQV<<K[<<K[O&<sQWO<<K[O%/kQWO<<K[O&<xQWO<<K[OOQV<<Kl<<KlO%/kQWO<<KlOOQV<<Kn<<KnO%0ZQWO<<KnO&=QQWO<<KrO$>PQYO<<KrOOQV<<K}<<K}O%5hQWO<<K}O%5mQWO<<K}O#G{QWO<<K}OOQV<<Kt<<KtO&=YQWO<<KtO$>PQYO<<KtO&=bQWO<<L[O$>PQYO<<L[O&=mQWO<<L[OOQV<<Hb<<HbO$>PQYO7+(uOOQO7+*V7+*VOOQR7+$i7+$iO&=rQWO,5@lOOQO'#Gm'#GmO&=zQWO'#GmO&>VQYO'#IUO&=rQWO,5@lOOQR1G3]1G3]O&?rQYO,5=vO&ARQYO,5=XO&A]QWO,5=XOOQO,5=X,5=XOOQR7+(u7+(uO&AbQZO7+(uO&CtQZO7+(|O&FTQWO,5>qOOQO-E<T-E<TO&F`QWO7+)QOOQO<<G}<<G}O&FgQYO'#ITO&FrQYO,5@jOOQQ7+(v7+(vOOQQ<<He<<HeO$>PQYO<<K|OOQV<<K|<<K|O&3}QWO<<K|O&FzQWO<<K|O%5hQWO<<K|O&GSQWO7+%YOOQV<<Hr<<HrOOQO<<Jn<<JnO%?pQ_O,5;SO&GZQWO,5;SO%?pQ_O'#EjO&G`QWO,5;SOOQU-E;m-E;mO&GkQWO1G0mOOQV1G0m1G0mO&&TQ^O1G0mOOQV<<Jy<<JyO!.cQ_O<<J}OOQV<<J}<<J}OOQV<<Hd<<HdO%?pQ_O<<HdO&GpQWO'#JTO&GxQWO'#FvO&G}QWO<<KQO&HVQ!fO<<KQO&H^QWO<<KQO&HcQWO<<KQO&HkQ!fO<<KQOOQV<<KQ<<KQO&HrQWO<<LZO&HwQWO,5@[O$>PQYO,5<xO&IPQWO,5<xO&IUQWO'#H{O&HwQWO,5@[OOQV1G2c1G2cO&IjQWO,5@^O$>PQYO,5@^O&IuQYO'#H|O&K[QWO,5@^OOQO1G2e1G2eO%,bQWO,5<uOOQO,5<v,5<vO&KdQYO'#HzO&LvQWO,5@XO%,UQYO,5=pO$>PQYO,5<oO&MRQWO,5@`O%?pQ_O,5=PO&MZQWO,5=PO&MfQWO,5=PO&MwQWO'#H}O&MRQWO,5@`OOQV1G2j1G2jO&N]QYO,5<pO%0`QYO,5>PO&NtQYO,5@VOOQV<<Kr<<KrO' ]QWO,5=XO' mQ^O,5:hO'!pQWO,5=XO$>PQYO,5=WO'!xQWO,5@cO'#QQWO,5@cO'#`Q^O'#IPO'!xQWO,5@cOOQO1G2q1G2qO'$rQWO,5=WO'$zQWO<<KtO'%YQYO,5>oO'%eQYO,5>dO'%sQYO,5>dOOQQ,5>d,5>dOOQQ-E;v-E;vOOQQ7+'r7+'rO'&OQYO1G2]O$>PQYO1G2^OOQV<<LQ<<LQO%?pQ_O<<LQO'&ZQWO<<LQO'&bQWO<<LQOOQO,5>m,5>mOOQO-E<P-E<POOQV<<L[<<L[O%?pQ_O<<L[O'&mQYO1G/QO'&xQYO,5>nOOQQ,5>n,5>nO''TQYO,5>nOOQQ-E<Q-E<QOOQS1G0^1G0^O')cQ!fO1G0`O')pQ!fO1G0`O')wQ^O'#IWO'*eQWO,5@oOOQO7+$Z7+$ZO'*mQWO1G3wOOQOAN@UAN@UO'*wQWO1G/zOOQO,5>X,5>XOOQO-E;k-E;kO!1PQ^O1G/zOOQO1G/z1G/zO'+SQWO1G/zO'+XQXO1G1kO$>PQYO1G1kO'+dQWO7+'[OOQVANA`ANA`O'+nQWOANA`O$>PQYOANA`O'+vQWOANA`OOQVAN>OAN>OO%?pQ_OAN>OO',UQWOANAuOOQVAN@vAN@vO',ZQWOAN@vOOQVANAWANAWOOQVANAYANAYOOQVANA^ANA^O',`QWOANA^OOQVANAiANAiO%5hQWOANAiO%5mQWOANAiO',hQWOANA`OOQVANAvANAvO%?pQ_OANAvO',vQWOANAvO$>PQYOANAvOOQR<<La<<LaO'-RQWO1G6WO%JsQWO,5>pOOQO'#HY'#HYO'-ZQWO'#HZOOQO,5>p,5>pOOQO-E<S-E<SO'-fQYO1G2sO'-pQWO1G2sOOQO1G2s1G2sO$>PQYO<<LaOOQR<<Ll<<LlOOQQ,5>o,5>oOOQQ-E<R-E<RO&3}QWOANAhOOQVANAhANAhO%5hQWOANAhO$>PQYOANAhO'-uQWO1G1rO'.iQ^O1G0nO%?pQ_O1G0nO'0_QWO,5;UO'0fQWO1G0nP'0kQWO'#ERP&&TQ^O'#HpOOQV7+&X7+&XO'0vQWO7+&XO&&yQWOAN@iO'0{QWOAN>OO!5oQWO,5<bOOQS,5>a,5>aO'1SQWOAN@lO'1XQWOAN@lOOQS-E;s-E;sOOQVAN@lAN@lO'1aQWOAN@lOOQVANAuANAuO'1iQWO1G5vO'1qQWO1G2dO$>PQYO1G2dO&*nQWO,5>gOOQO,5>g,5>gOOQO-E;y-E;yO'1|QWO1G5xO'2UQWO1G5xO&+`QYO,5>hO'2aQWO,5>hO$>PQYO,5>hOOQO-E;z-E;zO'2lQWO'#JnOOQO1G2a1G2aOOQO,5>f,5>fOOQO-E;x-E;xO&*TQYO,5<lO'2zQYO1G2ZO'3fQWO1G5zO'3nQWO1G2kO%?pQ_O1G2kO'3xQWO1G2kO&-vQWO,5>iOOQO,5>i,5>iOOQO-E;{-E;{OOQQ,5>c,5>cOOQQ-E;u-E;uO'4TQWO1G2sO'4eQWO1G2rO'4pQWO1G5}O'4xQ^O,5>kOOQO'#Go'#GoOOQO,5>k,5>kO'6UQWO,5>kOOQO-E;}-E;}O$>PQYO1G2rO'6dQYO7+'xO'6oQWOANAlOOQVANAlANAlO%?pQ_OANAlO'6vQWOANAvOOQS7+%z7+%zO'6}QWO7+%zO'7YQ!fO7+%zOOQO,5>r,5>rOOQO-E<U-E<UO'7gQWO7+%fO!1PQ^O7+%fO'7rQXO7+'VOOQVG26zG26zO'7}QWOG26zO'8]QWOG26zO$>PQYOG26zO'8eQWOG23jOOQVG27aG27aOOQVG26bG26bOOQVG26xG26xOOQVG27TG27TO%5hQWOG27TO'8lQWOG27bOOQVG27bG27bO%?pQ_OG27bO'8sQWOG27bOOQO1G4[1G4[OOQO7+(_7+(_OOQRANA{ANA{OOQVG27SG27SO%5hQWOG27SO&3}QWOG27SO'9OQ^O7+&YO':iQWO7+'^O';]Q^O7+&YO%?pQ_O7+&YP%?pQ_O,5;SP'<iQWO,5;SP'<nQWO,5;SOOQV<<Is<<IsOOQVG26TG26TOOQVG23jG23jOOQO1G1|1G1|OOQVG26WG26WO'<yQWOG26WP&HfQWO'#HuO'=OQWO7+(OOOQO1G4R1G4RO'=ZQWO7++dO'=cQWO1G4SO$>PQYO1G4SO%,bQWO'#HyO'=nQWO,5@YO'=|QWO7+(VO%?pQ_O7+(VOOQO1G4T1G4TOOQO1G4V1G4VO'>WQWO1G4VO'>fQWO7+(^OOQVG27WG27WO'>qQWOG27WOOQS<<If<<IfO'>xQWO<<IfO'?TQWO<<IQOOQVLD,fLD,fO'?`QWOLD,fO'?hQWOLD,fOOQVLD)ULD)UOOQVLD,oLD,oOOQVLD,|LD,|O'?vQWOLD,|O%?pQ_OLD,|OOQVLD,nLD,nO%5hQWOLD,nO'?}Q^O<<ItO'AhQWO<<JxO'B[Q^O<<ItP'ChQWO1G0nP'DXQ^O1G0nP%?pQ_O1G0nP'EzQWO1G0nOOQVLD+rLD+rO'FPQWO7+)nOOQO,5>e,5>eOOQO-E;w-E;wO'F[QWO<<KqOOQVLD,rLD,rOOQSAN?QAN?QOOQV!$(!Q!$(!QO'FfQWO!$(!QOOQV!$(!h!$(!hO'FnQWO!$(!hOOQV!$(!Y!$(!YO'FuQ^OAN?`POQU7+&Y7+&YP'H`QWO7+&YP'IPQ^O7+&YP%?pQ_O7+&YOOQV!)9El!)9ElOOQV!)9FS!)9FSPOQU<<It<<ItP'JrQWO<<ItP'KcQ^O<<ItPOQUAN?`AN?`O'MUQWO'#CnO'M]QXO'#CnO'NUQWO'#IaO( kQXO'#IaO(!bQWO'#DpO(!bQWO'#DpO!.cQ_O'#EkO(!sQ_O'#EoO(!zQ_O'#FPO(%{Q_O'#FbO(&SQXO'#IaO(&yQ_O'#E}O('|Q_O'#FWO(!bQWO,5:[O(!bQWO,5:[O!.cQ_O,5;ZO!.cQ_O,5;]O!.cQ_O,5;]O!.cQ_O,5;]O!.cQ_O,5;]O!.cQ_O,5;]O!.cQ_O,5;]O!.cQ_O,5;]O!.cQ_O,5;]O!.cQ_O,5;]O!.cQ_O,5;fO()PQ_O,5;kO(,QQWO,5;kO(,bQWO,5;|O(,iQYO'#CuO(,tQYO'#CvO(-PQWO'#CwO(-PQWO'#CwO(-bQYO'#CtO(-mQWO,5;iO(-tQWO,5;rO(-{Q_O,5;rO(/RQ_O,5;|O(!bQWO1G/vO(/YQWO1G0uO(0wQWO1G0wO(1RQWO1G0wO(2vQWO1G0wO(2}QWO1G0wO(4oQWO1G0wO(4vQWO1G0wO(6hQWO1G0wO(6oQWO1G0wO(6vQWO1G1QO(7WQWO1G1VO(7hQYO'#IfO(-PQWO,59cO(-PQWO,59cO(7sQWO1G1^O(7zQWO1G1hO(-PQWO1G.}O(8RQWO'#DpO!.^QXO'#FbO(8WQWO,5;ZO(8_QWO'#Cw",
  stateData: "(8q~O&}OSUOS'OPQ~OPoOQ!QOSVOTVOZeO[lO^RO_RO`ROa!UOd[Og!nOsVOtVOuVOw!POyvO|!VO}mO!Q!dO!U!WO!W!XO!X!^O!Z!YO!]!pO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO$i!eO$m!fO$q!gO$s!hO%T!iO%V!jO%Z!kO%]!lO%^!mO%f!oO%j!qO%s!rO'R`O'UQO'[kO'_UO'hcO'riO(QdO~O'O!sO~OZbX[bXdbXdlXobXwjX}bX!lbX!qbX!tbX#QbX#RbX#pbX'hbX'rbX'sbX'xbX'ybX'zbX'{bX'|bX'}bX(ObX(PbX(QbX(RbX(TbX~OybXXbX!ebX!PbXvbX#TbX~P$|OZ'TX['TXd'TXd'YXo'TXw'lXy'TX}'TX!l'TX!q'TX!t'TX#Q'TX#R'TX#p'TX'h'TX'r'TX's'TX'x'TX'y'TX'z'TX'{'TX'|'TX'}'TX(O'TX(P'TX(Q'TX(R'TX(T'TXv'TX~OX'TX!e'TX!P'TX#T'TX~P'ZOr!uO'^!wO'`!uO~Od!xO~O^RO_RO`ROaRO'UQO~Od!}O~Od#PO[(SXo(SXy(SX}(SX!l(SX!q(SX!t(SX#Q(SX#R(SX#p(SX'h(SX'r(SX's(SX'x(SX'y(SX'z(SX'{(SX'|(SX'}(SX(O(SX(P(SX(Q(SX(R(SX(T(SXv(SX~OZ#OO~P*`OZ#RO[#QO~OQ!QO^#TO_#TO`#TOa#]Od#ZOg!nOyvO|!VO!Q!dO!U#^O!W!lO!]!pO$i!eO$m!fO$q!gO$s!hO%T!iO%V!jO%Z!kO%]!lO%^!mO%f!oO%j!qO%s!rO'R#VO'U#SO~OPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO'hcO'riO(QdO~P)xOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!j#eO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO'hcO'riO(QdO~P)xO[#}Oo#xO}#zO!l#yO!q#jO!t#yO#Q#xO#R#uO#p$OO'h#gO'r#yO's#lO'x#hO'y#iO'z#iO'{#kO'|#nO'}#mO(O#|O(P#gO(Q#hO(R#fO(T#hO~OPoOQ!QOSVOTVOZeOd[OsVOtVOuVOw!PO!U#bO!W#cO!X!^O!Z!YO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO[#sXo#sXy#sX}#sX!l#sX!q#sX!t#sX#Q#sX#R#sX#p#sX'h#sX'r#sX's#sX'x#sX'y#sX'z#sX'{#sX'|#sX'}#sX(O#sX(P#sX(Q#sX(R#sX(T#sXX#sX!e#sX!P#sXv#sX#T#sX~P)xOX(SX!e(SX!P(SXw(SX#T(SX~P*`OPoOQ!QOSVOTVOX$ROZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'R$UO'[kO'_UO'hcO'riO(QdO~P)xOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!P$XO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'R$UO'[kO'_UO'hcO'riO(QdO~P)xOQ!QOSVOTVO[$gO^$pO_$ZO`:QOa:QOd$aOsVOtVOuVO}$eO!i$qO!l$lO!q$hO#V$lO'U$YO'_UO'h$[O~O!j$rOP(XP~P<cOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#S$uO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO'hcO'riO(QdO~P)xOw$vO~Oo'cX#Q'cX#R'cX#p'cX's'cX'x'cX'y'cX'z'cX'{'cX'|'cX'}'cX(O'cX(P'cX(R'cX(T'cX~OP%tXQ%tXS%tXT%tXZ%tX[%tX^%tX_%tX`%tXa%tXd%tXg%tXs%tXt%tXu%tXw%tXy%tX|%tX}%tX!Q%tX!U%tX!W%tX!X%tX!Z%tX!]%tX!l%tX!q%tX!t%tX#Y%tX#r%tX#{%tX$O%tX$b%tX$d%tX$f%tX$i%tX$m%tX$q%tX$s%tX%T%tX%V%tX%Z%tX%]%tX%^%tX%f%tX%j%tX%s%tX&{%tX'R%tX'U%tX'[%tX'_%tX'h%tX'r%tX(Q%tXv%tX~P@[Oy$xO['cX}'cX!l'cX!q'cX!t'cX'h'cX'r'cX(Q'cXv'cX~P@[Ow$yO!Q(iX!U(iX!W(iX$q(iX%](iX%^(iX~Oy$zO~PEsO!Q$}O!U%UO!W!lO$m%OO$q%PO$s%QO%T%RO%V%SO%Z%TO%]!lO%^%VO%f%WO%j%XO%s%YO~O!Q!lO!U!lO!W!lO$q%[O%]!lO~O%^%VO~PGaOPoOQ!QOSVOTVOZeO[lO^RO_RO`ROa!UOd[Og!nOsVOtVOuVOw!POyvO|!VO}mO!Q!dO!U!WO!W!XO!X!^O!Z!YO!]!pO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO$i!eO$m!fO$q!gO$s!hO%T!iO%V!jO%Z!kO%]!lO%^!mO%f!oO%j!qO%s!rO'R#VO'UQO'[kO'_UO'hcO'riO(QdO~Ov%`O~P]OQ!QOZ%rO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!q%oO$f%wO%^%xO&W%{O'U%dO'[%eO(Q%zO~PGaO!Q{X!U{X!W{X$m{X$q{X$s{X%T{X%V{X%Z{X%]{X%^{X%f{X%j{X%s{X~P'ZO!Q{X!U{X!W{X$m{X$q{X$s{X%T{X%V{X%Z{X%]{X%^{X%f{X%j{X%s{X~O}%}O'U{XQ{XZ{X[{X^{X_{X`{Xa{Xd{Xg{X!q{X$f{X&W{X'[{X(Q{X~PMuOg&PO%f%WO!Q(iX!U(iX!W(iX$q(iX%](iX%^(iX~Ow!PO~P! yOw!PO!X&RO~PEvOPoOQ!QOSVOTVOZeO[lO^9xO_9xO`9xOa9xOd9{OsVOtVOuVOw!PO}mO!U#bO!W#cO!X;RO!Z!YO!]&UO!l:OO!q9}O!t:OO#Y!_O#r:RO#{:SO$O!]O$b!`O$d!bO$f!cO'U9vO'[kO'_UO'hcO'r:OO(QdO~OPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO'hcO'riO(QdOo#qXy#qX#Q#qX#R#qX#p#qX's#qX'x#qX'y#qX'z#qX'{#qX'|#qX'}#qX(O#qX(P#qX(R#qX(T#qXX#qX!e#qX!P#qXv#qX#T#qX~P)xOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO'hcO'riO(QdOo#zXy#zX#Q#zX#R#zX#p#zX's#zX'x#zX'y#zX'z#zX'{#zX'|#zX'}#zX(O#zX(P#zX(R#zX(T#zXX#zX!e#zX!P#zXv#zX#T#zX~P)xO'[kO[#}Xo#}Xy#}X}#}X!l#}X!q#}X!t#}X#Q#}X#R#}X#p#}X'h#}X'r#}X's#}X'x#}X'y#}X'z#}X'{#}X'|#}X'}#}X(O#}X(P#}X(Q#}X(R#}X(T#}XX#}X!e#}X!P#}Xv#}Xw#}X#T#}X~OPoO~OPoOQ!QOSVOTVOZeO[lO^9xO_9xO`9xOa9xOd9{OsVOtVOuVOw!PO}mO!U#bO!W#cO!X;RO!Z!YO!l:OO!q9}O!t:OO#Y!_O#r:RO#{:SO$O!]O$b!`O$d!bO$f!cO'U9vO'[kO'_UO'hcO'r:OO(QdO~O!S&_O~Ow!PO~O!j&bO~P<cO'U&cO~PEvOZ&eO~O'U&cO~O'_UOw(^Xy(^X!Q(^X!U(^X!W(^X$q(^X%](^X%^(^X~Oa&hO~P!1iO'U&iO~O_&nO'U&cO~OQ&oOZ&pO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!q%oO$f%wO%^%xO&W%{O'U%dO'[%eO(Q%zO~PGaO!j&uO~P<cO^&wO_&wO`&wOa&wOd'POw&|O'U&vO(Q&}O~O!i'UO!j'TO'U&cO~O'O!sO'P'VO'Q'XO~Or!uO'^'ZO'`!uO~OQ']O^'ja_'ja`'jaa'ja'U'ja~O['bOw'cO}'dO~OQ']O~OQ!QO^#TO_#TO`#TOa'jOd#ZO'U#SO~O['kO~OZbXdlXXbXobXPbX!SbX!ebX'sbX!PbX!ObXybX!ZbX#TbXvbX~O}bX~P!6mOZ'TXd'YXX'TXo'TX}'TX#p'TXP'TX!S'TX!e'TX's'TX!P'TX!O'TXy'TX!Z'TX#T'TXv'TX~O^#TO_#TO`#TOa'jO'U#SO~OZ'lO~Od'nO~OZ'TXd'YX~PMuOZ'oOX(SX!e(SX!P(SXw(SX#T(SX~P*`O[#}O}#zO(O#|O(R#fOo#_ay#_a!l#_a!q#_a!t#_a#Q#_a#R#_a#p#_a'h#_a'r#_a's#_a'x#_a'y#_a'z#_a'{#_a'|#_a'}#_a(P#_a(Q#_a(T#_aX#_a!e#_a!P#_av#_aw#_a#T#_a~Ow!PO!X&RO~Oy#caX#ca!e#ca!P#cav#ca#T#ca~P2gOPoOQ!QOSVOTVOZeOd[OsVOtVOuVOw!PO!U#bO!W#cO!X!^O!Z!YO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO[#sao#say#sa}#sa!l#sa!q#sa!t#sa#Q#sa#R#sa#p#sa'h#sa'r#sa's#sa'x#sa'y#sa'z#sa'{#sa'|#sa'}#sa(O#sa(P#sa(Q#sa(R#sa(T#saX#sa!e#sa!P#sav#sa#T#sa~P)xOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'R#VO'[kO'_UO'hcO'riO(QdO!P(UP~P)xOu(RO#w(SO'U(QO~O[#}O}#zO!q#jO'h#gO's#lO'x#hO'y#iO'z#iO'{#kO'|#nO'}#mO(O#|O(P#gO(Q#hO(R#fO(T#hO!l#sa!t#sa#p#sa'r#sa~Oo#xO#Q#xO#R#uOy#saX#sa!e#sa!P#sav#sa#T#sa~P!BqOy(XO!e(VOX(WX~P2gOX(YO~OPoOQ!QOSVOTVOX(YOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'R$UO'[kO'_UO'hcO'riO(QdO~P)xOZ#RO~O!P(^O!e(VO~P2gOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'R$UO'[kO'_UO'hcO'riO(QdO~P)xOZbXdlXwjX}jX!tbX'rbX~OP!RX!S!RX!e!RX'q!RX's!RX!O!RXo!RXy!RX!P!RXX!RX!Z!RX#T!RXv!RX~P!IxOZ'TXd'YXw'lX}'lX!t'TX'r'TX~OP!`X!S!`X!e!`X's!`X!O!`Xo!`Xy!`X!P!`XX!`X!Z!`X#T!`Xv!`X~P!KZOT(`Ou(`O~O!t(aO'r(aOP!^X!S!^X!e!^X's!^X!O!^Xo!^Xy!^X!P!^XX!^X!Z!^X#T!^Xv!^X~O^9yO_9yO`:QOa:QO'U9wO~Od(dO~O'q(eOP'iX!S'iX!e'iX's'iX!O'iXo'iXy'iX!P'iXX'iX!Z'iX#T'iXv'iX~O!j&bO!P'mP~P<cOw(jO}(iO~O!j&bOX'mP~P<cO!j(nO~P<cOZ'oO!t(aO'r(aO~O!S(pO's(oOP$WX!e$WX~O!e(qOP(YX~OP(sO~OP!aX!S!aX!e!aX's!aX!O!aXo!aXy!aX!P!aXX!aX!Z!aX#T!aXv!aX~P!KZOy$UaX$Ua!e$Ua!P$Uav$Ua#T$Ua~P2gO!l({O'R#VO'U(wOv(ZP~OQ!QO^#TO_#TO`#TOa#]Od#ZOg!nOyvO|!VO!Q!dO!U#^O!W!lO!]!pO$i!eO$m!fO$q!gO$s!hO%T!iO%V!jO%Z!kO%]!lO%^!mO%f!oO%j!qO%s!rO'R`O'U#SO~Ov)SO~P#$]Oy)UO~PEsO%^)VO~PGaOa)YO~P!1iO%f)_O~PEvO_)`O'U&cO~O!i)eO!j)dO'U&cO~O'_UO!Q(^X!U(^X!W(^X$q(^X%](^X%^(^X~Ov%uX~P2gOv)fO~PGyOv)fO~Ov)fO~P]OQiXQ'YXZiXd'YX}iX#piX(PiX~ORiXwiX$fiX$|iX[iXoiXyiX!liX!qiX!tiX#QiX#RiX'hiX'riX'siX'xiX'yiX'ziX'{iX'|iX'}iX(OiX(QiX(RiX(TiX!PiX!eiXXiXPiXviX!SiX#TiX~P#(_OQjXQlXRjXZjXdlX}jX#pjX(PjXwjX$fjX$|jX[jXojXyjX!ljX!qjX!tjX#QjX#RjX'hjX'rjX'sjX'xjX'yjX'zjX'{jX'|jX'}jX(OjX(QjX(RjX(TjX!PjX!ejXXjX!SjXPjXvjX#TjX~O%^)iO~PGaOQ']Od)jO~O^)lO_)lO`)lOa)lO'U%dO~Od)pO~OQ']OZ)tO})rOR'VX#p'VX(P'VXw'VX$f'VX$|'VX['VXo'VXy'VX!l'VX!q'VX!t'VX#Q'VX#R'VX'h'VX'r'VX's'VX'x'VX'y'VX'z'VX'{'VX'|'VX'}'VX(O'VX(Q'VX(R'VX(T'VX!P'VX!e'VXX'VXP'VXv'VX!S'VX#T'VX~OQ!QO^:iO_:eO`TOaTOd:hO%^)iO'U:fO~PGaOQ!QOZ%rO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!j)xO!q%oO$f%wO%^%xO&W%{O'U%dO'[%eO(Q%zO~PGaOQ!QOZ%rO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!P){O!q%oO$f%wO%^%xO&W%{O'U%dO'[%eO(Q%zO~PGaO(P)}O~OR*PO#p*QO(P*OO~OQhXQ'YXZhXd'YX}hX(PhX~ORhX#phXwhX$fhX$|hX[hXohXyhX!lhX!qhX!thX#QhX#RhX'hhX'rhX'shX'xhX'yhX'zhX'{hX'|hX'}hX(OhX(QhX(RhX(ThX!PhX!ehXXhXPhXvhX!ShX#ThX~P#4_OQ*RO~O})rO~OQ!QO^%vO_%cO`TOaTOd%jO$f%wO%^%xO'U%dO~PGaO!Q*UO!j*UO~O^*XO`*XOa*XO!O*YO~OQ&oOZ*ZO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!q%oO$f%wO%^%xO&W%{O'U%dO'[%eO(Q%zO~PGaO[#}Oo:aO}#zO!l:bO!q#jO!t:bO#Q:aO#R:^O#p$OO'h#gO'r:bO's#lO'x#hO'y#iO'z#iO'{#kO'|#nO'}#mO(O#|O(P#gO(Q#hO(R#fO(T#hO~Ow'eX~P#9jOy#qaX#qa!e#qa!P#qav#qa#T#qa~P2gOy#zaX#za!e#za!P#zav#za#T#za~P2gOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!S&_O!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO'hcO'riO(QdOo#zay#za#Q#za#R#za#p#za's#za'x#za'y#za'z#za'{#za'|#za'}#za(O#za(P#za(R#za(T#zaX#za!e#za!P#zav#za#T#za~P)xOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#S*dO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO'hcO'riO(QdO~P)xOw*eO~P#9jO$b*hO$d*iO$f*jO~O!O*kO's(oO~O!S*mO~O'U*nO~Ow$yOy*pO~O'U*qO~OQ*tOw*uOy*xO}*vO$|*wO~OQ*tOw*uO$|*wO~OQ*tOw+PO$|*wO~OQ*tOo+UOy+WO!S+TO~OQ*tO}+YO~OQ!QOZ%rO[%qO^%vO`TOaTOd%jOg%yO}%pO!U!lO!W!lO!q%oO$f%wO$q%[O%]!lO%^%xO&W%{O'U%dO'[%eO(Q%zO~OR+aO_+]O!Q+bO~P#D_O_%cO!Q!lOw&UX$|&UX(P&UX~P#D_Ow$yO$f+gO$|*wO(P*OO~OQ!QOZ*ZO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!q%oO$f%wO%^%xO&W%{O'U%dO'[%eO(Q%zO~PGaOQ*tOw$yO!S+TO$|*wO~Oo+mOy+lO!S+nO's(oO~OdlXy!RX#pbXv!RX!e!RX~Od'YXy(mX#p'TXv(mX!e(mX~Od+pO~O^#TO_#TO`#TOa'jOw&|O'U&vO(Q+uO~Ov(oP~P!3|O#p+zO~Oy+{O~O!S+|O~O'O!sO'P'VO'Q,OO~Od,PO~OSVOTVO_%cOsVOtVOuVOw!PO!Q!lO'_UO~P#D_OS,_OT,_OZ,_O['bO_,ZOd,_Oo,_Os,_Ou,_Ow'cOy,_O}'dO!S,_O!e,_O!l,_O!q,]O!t,_O!{,_O#Q,_O#R,_O#S,_O#T,_O'R,_O'[%eO'_UO'h,[O's,]O'v,`O'x,[O'y,]O'z,]O'{,]O'|,^O'},^O(O,_O(P,aO(Q,aO(R,bO~OX,XO~P#K_Ov,dO~P#K_O!P,gO~P#K_Oo'ti#Q'ti#R'ti#p'ti's'ti'x'ti'y'ti'z'ti'{'ti'|'ti'}'ti(O'ti(P'ti(R'ti(T'ti~Oy,hO['ti}'ti!l'ti!q'ti!t'ti'h'ti'r'ti(Q'tiv'ti~P#N^OP$giQ$giS$giT$giZ$gi[$gi^$gi_$gi`$gia$gid$gig$gis$git$giu$giw$giy$gi|$gi}$gi!Q$gi!U$gi!W$gi!X$gi!Z$gi!]$gi!l$gi!q$gi!t$gi#Y$gi#r$gi#{$gi$O$gi$b$gi$d$gi$f$gi$i$gi$m$gi$q$gi$s$gi%T$gi%V$gi%Z$gi%]$gi%^$gi%f$gi%j$gi%s$gi&{$gi'R$gi'U$gi'[$gi'_$gi'h$gi'r$gi(Q$giv$gi~P#N^OX,iO~Oo,jO},kOX]X!P]X!e]X~Oy#ciX#ci!e#ci!P#civ#ci#T#ci~P2gO[#}O}#zO'x#hO(O#|O(Q#hO(R#fO(T#hOo#eiy#ei!l#ei!q#ei!t#ei#Q#ei#R#ei#p#ei'r#ei's#ei'y#ei'z#ei'{#ei'|#ei'}#eiX#ei!e#ei!P#eiv#ei#T#ei~O'h#ei(P#ei~P$&sO[#}O}#zO(O#|O(R#fOo#eiy#ei!l#ei!q#ei!t#ei#Q#ei#R#ei#p#ei'r#ei's#ei'y#ei'z#ei'{#ei'|#ei'}#eiX#ei!e#ei!P#eiv#ei#T#ei~O'h#ei'x#ei(P#ei(Q#ei(T#eiw#ei~P$(tO'h#gO(P#gO~P$&sO[#}O}#zO'h#gO'x#hO'y#iO'z#iO(O#|O(P#gO(Q#hO(R#fO(T#hOo#eiy#ei!l#ei!t#ei#Q#ei#R#ei#p#ei'r#ei's#ei'{#ei'|#ei'}#eiX#ei!e#ei!P#eiv#ei#T#ei~O!q#ei~P$+SO!q#jO~P$+SO[#}O}#zO!q#jO'h#gO'x#hO'y#iO'z#iO'{#kO(O#|O(P#gO(Q#hO(R#fO(T#hOo#eiy#ei!l#ei!t#ei#Q#ei#R#ei#p#ei'r#ei'|#ei'}#eiX#ei!e#ei!P#eiv#ei#T#ei~O's#ei~P$-[O's#lO~P$-[O[#}O}#zO!q#jO#R#uO'h#gO's#lO'x#hO'y#iO'z#iO'{#kO(O#|O(P#gO(Q#hO(R#fO(T#hOo#eiy#ei!l#ei!t#ei#Q#ei#p#ei'r#ei'|#eiX#ei!e#ei!P#eiv#ei#T#ei~O'}#ei~P$/dO'}#mO~P$/dO[#}O}#zO!q#jO'h#gO's#lO'x#hO'y#iO'z#iO'{#kO'|#nO'}#mO(O#|O(P#gO(Q#hO(R#fO(T#hO!l#ni!t#ni#p#ni'r#ni~Oo#xO#Q#xO#R#uOy#niX#ni!e#ni!P#niv#ni#T#ni~P$1lO[#}O}#zO!q#jO'h#gO's#lO'x#hO'y#iO'z#iO'{#kO'|#nO'}#mO(O#|O(P#gO(Q#hO(R#fO(T#hO!l#si!t#si#p#si'r#si~Oo#xO#Q#xO#R#uOy#siX#si!e#si!P#siv#si#T#si~P$3mOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'R#VO'[kO'_UO'hcO'riO(QdO~P)xO!e,rO!P(VX~P2gO!P,tO~OX,uO~P2gOPoOQ!QOSVOTVOZeO[lOd[OsVOtVOuVOw!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'[kO'_UO'hcO'riO(QdOX&fX!e&fX!P&fX~P)xO!e(VOX(Wa~Oy,yO!e(VOX(WX~P2gOX,zO~O!P,{O!e(VO~O!P,}O!e(VO~P2gOSVOTVOsVOtVOuVO'_UO'h$[O~P!6POP!baZca!S!ba!e!ba!tca'rca's!ba!O!bao!bay!ba!P!baX!ba!Z!ba#T!bav!ba~O!e-SO's(oO!P'nXX'nX~O!P-UO~O!i-_O!j-^O!l-ZO'U-WOv'oP~OX-`O~O_%cO!Q!lO~P#D_O!j-fOP&gX!e&gX~P<cO!e(qOP(Ya~O!S-hO's(oOP$Wa!e$Wa~Ow!PO(P*OO~OvbX!S!kX!ebX~O'R#VO'U(wO~O!S-lO~O!e-nOv([X~Ov-pO~Ov-rO~P,cOv-rO~P#$]O_-tO'U&cO~O!S-uO~Ow$yOy-vO~OQ*tOw*uOy-yO}*vO$|*wO~OQ*tOo.TO~Oy.^O~O!S._O~O!j.aO'U&cO~Ov.bO~Ov.bO~PGyOQ']O^'Xa_'Xa`'Xaa'Xa'U'Xa~Od.fO~OQ'YXQ'lXR'lXZ'lXd'YX}'lX#p'lX(P'lXw'lX$f'lX$|'lX['lXo'lXy'lX!l'lX!q'lX!t'lX#Q'lX#R'lX'h'lX'r'lX's'lX'x'lX'y'lX'z'lX'{'lX'|'lX'}'lX(O'lX(Q'lX(R'lX(T'lX!P'lX!e'lXX'lXP'lXv'lX!S'lX#T'lX~OQ!QOZ%rO[%qO^.qO_%cO`TOaTOd%jOg%yO}%pO!j.rO!q.oO!t.jO#V.lO$f%wO%^%xO&W%{O'R#VO'U%dO'[%eO(Q%zO!P(sP~PGaO#S.sOR%wa#p%wa(P%waw%wa$f%wa$|%wa[%wao%way%wa}%wa!l%wa!q%wa!t%wa#Q%wa#R%wa'h%wa'r%wa's%wa'x%wa'y%wa'z%wa'{%wa'|%wa'}%wa(O%wa(Q%wa(R%wa(T%wa!P%wa!e%waX%waP%wav%wa!S%wa#T%wa~O%^.uO~PGaO(P*OOR&Oa#p&Oaw&Oa$f&Oa$|&Oa[&Oao&Oay&Oa}&Oa!l&Oa!q&Oa!t&Oa#Q&Oa#R&Oa'h&Oa'r&Oa's&Oa'x&Oa'y&Oa'z&Oa'{&Oa'|&Oa'}&Oa(O&Oa(Q&Oa(R&Oa(T&Oa!P&Oa!e&OaX&OaP&Oav&Oa!S&Oa#T&Oa~O_%cO!Q!lO!j.wO(P)}O~P#D_O!e.xO(P*OO!P(uX~O!P.zO~OX.{Oy.|O(P*OO~O'[%eOR(qP~OQ']O})rORfa#pfa(Pfawfa$ffa$|fa[faofayfa!lfa!qfa!tfa#Qfa#Rfa'hfa'rfa'sfa'xfa'yfa'zfa'{fa'|fa'}fa(Ofa(Qfa(Rfa(Tfa!Pfa!efaXfaPfavfa!Sfa#Tfa~OQ']O})rOR&Va#p&Va(P&Vaw&Va$f&Va$|&Va[&Vao&Vay&Va!l&Va!q&Va!t&Va#Q&Va#R&Va'h&Va'r&Va's&Va'x&Va'y&Va'z&Va'{&Va'|&Va'}&Va(O&Va(Q&Va(R&Va(T&Va!P&Va!e&VaX&VaP&Vav&Va!S&Va#T&Va~O!P/TO~Ow$yO$f/YO$|*wO(P*OO~OQ!QOZ/ZO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!q%oO$f%wO%^%xO&W%{O'U%dO'[%eO(Q%zO~PGaOo/]O's(oO~O#W/^OP!YiQ!YiS!YiT!YiZ!Yi[!Yi^!Yi_!Yi`!Yia!Yid!Yig!Yio!Yis!Yit!Yiu!Yiw!Yiy!Yi|!Yi}!Yi!Q!Yi!U!Yi!W!Yi!X!Yi!Z!Yi!]!Yi!l!Yi!q!Yi!t!Yi#Q!Yi#R!Yi#Y!Yi#p!Yi#r!Yi#{!Yi$O!Yi$b!Yi$d!Yi$f!Yi$i!Yi$m!Yi$q!Yi$s!Yi%T!Yi%V!Yi%Z!Yi%]!Yi%^!Yi%f!Yi%j!Yi%s!Yi&{!Yi'R!Yi'U!Yi'[!Yi'_!Yi'h!Yi'r!Yi's!Yi'x!Yi'y!Yi'z!Yi'{!Yi'|!Yi'}!Yi(O!Yi(P!Yi(Q!Yi(R!Yi(T!YiX!Yi!e!Yi!P!Yiv!Yi!i!Yi!j!Yi#V!Yi#T!Yi~Oy#ziX#zi!e#zi!P#ziv#zi#T#zi~P2gOy$UiX$Ui!e$Ui!P$Uiv$Ui#T$Ui~P2gOv/dO!j&bO'R`O~P<cOw/mO}/lO~Oy!RX#pbX~Oy/nO~O#p/oO~OR+aO_+cO!Q/rO'U&iO'[%eO~Oa/yO|!VO'R#VO'U(QOv(cP~OQ!QOZ%rO[%qO^%vO_%cO`TOa/yOd%jOg%yO|!VO}%pO!q%oO$f%wO%^%xO&W%{O'R#VO'U%dO'[%eO(Q%zO!P(eP~PGaOQ!QOZ%rO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!q%oO$f0UO%^%xO&W%{O'U%dO'[%eO(Q%zOw(`Py(`P~PGaOw*uO~Oy-yO$|*wO~Oa/yO|!VO'R#VO'U*nOv(gP~Ow+PO~OQ!QOZ%rO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!q%oO$f0UO%^%xO&W%{O'U%dO'[%eO(Q%zO(R0_O~PGaOy0cO~OQ!QOSVOTVO[$gO^0kO_$ZO`:QOa:QOd$aOsVOtVOuVO}$eO!i$qO!j0lO!l$lO!q0dO!t0gO'R#VO'U$YO'[%eO'_UO'h$[O~O#V0mO!P(jP~P%1qOw!POy0oO#S0qO$|*wO~OR0tO!e0rO~P#(_OR0tO!S+TO!e0rO(P)}O~OR0tOo0vO!S+TO!e0rOQ'WXZ'WX}'WX#p'WX(P'WX~OR0tOo0vO!e0rO~OR0tO!e0rO~O$f/YO(P*OO~Ow$yO~Ow$yO$|*wO~Oo0|Oy0{O!S0}O's(oO~O!e1OOv(pX~Ov1QO~O^#TO_#TO`#TOa'jOw&|O'U&vO(Q1UO~Oo1XOQ'WXR'WXZ'WX}'WX!e'WX(P'WX~O!e1YO(P*OOR'ZX~O!e1YOR'ZX~O!e1YO(P)}OR'ZX~OR1[O~OX1]O~P#K_O!S1_OS'wXT'wXX'wXZ'wX['wX_'wXd'wXo'wXs'wXu'wXw'wXy'wX}'wX!e'wX!l'wX!q'wX!t'wX!{'wX#Q'wX#R'wX#S'wX#T'wX'R'wX'['wX'_'wX'h'wX's'wX'v'wX'x'wX'y'wX'z'wX'{'wX'|'wX'}'wX(O'wX(P'wX(Q'wX(R'wXv'wX!P'wX~O}1`O~Ov1aO~P#K_O!P1bO~P#K_OSVOTVOsVOtVOuVO'_UO~OSVOTVOsVOtVOuVO'_UO!P(vP~P!6POX1gO~Oy,hO~O!e,rO!P(Va~P2gOPoOQ!QOZeO[lO^RO_RO`ROaROd[Ow!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'R#VO'UQO'[kO'hcO'riO(QdO!P&eX!e&eX~P%;dO!e,rO!P(Va~OX&fa!e&fa!P&fa~P2gOX1lO~P2gOPoOQ!QOZeO[lO^RO_RO`ROaROd[Ow!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'UQO'[kO'hcO'riO(QdO~P%;dO!P1nO!e(VO~OP!biZci!S!bi!e!bi!tci'rci's!bi!O!bio!biy!bi!P!biX!bi!Z!bi#T!biv!bi~O's(oOP!oi!S!oi!e!oi!O!oio!oiy!oi!P!oiX!oi!Z!oi#T!oiv!oi~O!j&bO!P&`X!e&`XX&`X~P<cO!e-SO!P'naX'na~O!P1rO~Ov!RX!S!kX!e!RX~O!S1sO~O!e1tOv'pX~Ov1vO~O'U-WO~O!j1yO'U-WO~O(P*OOP$Wi!e$Wi~O!S1zO's(oOP$XX!e$XX~O!S1}O~Ov$_a!e$_a~P2gO!l({O'R#VO'U(wOv&hX!e&hX~O!e-nOv([a~Ov2RO~P,cOy2VO~O#p2WO~Oy2XO$|*wO~Ow*uOy2XO}*vO$|*wO~Oo2bO~Ow!POy2gO#S2iO$|*wO~O!S2kO~Ov2mO~O#S2nOR%wi#p%wi(P%wiw%wi$f%wi$|%wi[%wio%wiy%wi}%wi!l%wi!q%wi!t%wi#Q%wi#R%wi'h%wi'r%wi's%wi'x%wi'y%wi'z%wi'{%wi'|%wi'}%wi(O%wi(Q%wi(R%wi(T%wi!P%wi!e%wiX%wiP%wiv%wi!S%wi#T%wi~Od2oO~O^2rO!j.rO!q2sO'R#VO'[%eO~O(P*OO!P%{X!e%{X~O!e2tO!P(tX~O!P2vO~OQ!QOZ%rO[%qO^2xO_%cO`TOaTOd%jOg%yO}%pO!j2yO!q%oO$f%wO%^%xO&W%{O'U%dO'[%eO(Q%zO~PGaO^2zO!j2yO(P)}O~O!P%aX!e%aX~P#4_O^2zO~O(P*OOR&Oi#p&Oiw&Oi$f&Oi$|&Oi[&Oio&Oiy&Oi}&Oi!l&Oi!q&Oi!t&Oi#Q&Oi#R&Oi'h&Oi'r&Oi's&Oi'x&Oi'y&Oi'z&Oi'{&Oi'|&Oi'}&Oi(O&Oi(Q&Oi(R&Oi(T&Oi!P&Oi!e&OiX&OiP&Oiv&Oi!S&Oi#T&Oi~O_%cO!Q!lO!P&yX!e&yX~P#D_O!e.xO!P(ua~OR3RO(P*OO~O!e3SOR(rX~OR3UO~O(P*OOR&Pi#p&Piw&Pi$f&Pi$|&Pi[&Pio&Piy&Pi}&Pi!l&Pi!q&Pi!t&Pi#Q&Pi#R&Pi'h&Pi'r&Pi's&Pi'x&Pi'y&Pi'z&Pi'{&Pi'|&Pi'}&Pi(O&Pi(Q&Pi(R&Pi(T&Pi!P&Pi!e&PiX&PiP&Piv&Pi!S&Pi#T&Pi~O!P3VO~O$f3WO(P*OO~Ow$yO$f3WO$|*wO(P*OO~Ow!PO!Z!YO~O!Z3bO#T3`O's(oO~O!j&bO'R#VO~P<cOv3fO~Ov3fO!j&bO'R`O~P<cO!O3iO's(oO~Ow!PO~P#9jOo3lOy3kO(P*OO~OS,_OT,_OZ,_O['bO_3mOd,_Oo,_Os,_Ou,_Ow'cOy,_O}'dO!S,_O!e,_O!l,_O!q,]O!t,_O!{,_O#Q,_O#R,_O#S,_O#T,_O'R,_O'[%eO'_UO'h,[O's,]O'v,`O'x,[O'y,]O'z,]O'{,]O'|,^O'},^O(O,_O(P,aO(Q,aO(R,bO~O!P3qO~P&']Ov3tO~P&']OR0tO!S+TO!e0rO~OR0tOo0vO!S+TO!e0rO~Oa/yO|!VO'R#VO'U(QO~O!S3wO~O!e3yOv(dX~Ov3{O~OQ!QOZ%rO[%qO^%vO_%cO`TOa/yOd%jOg%yO|!VO}%pO!q%oO$f%wO%^%xO&W%{O'R#VO'U%dO'[%eO(Q%zO~PGaO!e4OO(P*OO!P(fX~O!P4QO~O!S4RO(P)}O~O!S+TO(P*OO~O!e4TOw(aXy(aX~OQ4VO~Oy2XO~Oa/yO|!VO'R#VO'U*nO~Oo4YOw*uO}*vOv%XX!e%XX~O!e4]Ov(hX~Ov4_O~O(P4aOy(_Xw(_X$|(_XR(_Xo(_X!e(_X~Oy4cO(P*OO~OQ!QO[$gO^4dO_$ZO`:QOa:QOd$aO}$eO!i$qO!j4eO!l$lO!q$hO#V$lO'U$YO'[%eO'h$[O~P%;dO!S4gO's(oO~O#V4iO~P%1qO!e4jO!P(kX~O!P4lO~O!P%aX!S!aX!e%aX's!aX~P!KZOQ!QO[$gO^4dO_$ZO`:QOa:QOd$aO}$eO!i$qO!j&bO!l$lO!q$hO#V$lO'U$YO'h$[O~P%;dO!e4jO!P(kX!S'fX's'fX~O^2zO!j2yO~Ow!POy2gO~O_4rO!Q/rO'U&iO'[%eOR&lX!e&lX~OR4tO!e0rO~O!S4vO~Ow$yO$|*wO(P*OO~Oy4wO~P2gOo4xOy4wO(P*OO~Ov&uX!e&uX~P!3|O!e1OOv(pa~Oo5OOy4}O(P*OO~OSVOTVO_%cOsVOtVOuVOw!PO!Q!lO'_UOR&vX!e&vX~P#D_O!e1YOR'Za~O!{5UO~O!P5VO~P#K_O!e5XO!P(wX~O!P5ZO~O!e,rO!P(Vi~OPoOQ!QOZeO[lO^RO_RO`ROaROd[Ow!PO}mO!U#bO!W#cO!X!^O!Z!YO!liO!qgO!tiO#Y!_O#r!ZO#{![O$O!]O$b!`O$d!bO$f!cO'R#VO'UQO'[kO'hcO'riO(QdO~P%;dO!P&ea!e&ea~P2gOX5]O~P2gOP!bqZcq!S!bq!e!bq!tcq'rcq's!bq!O!bqo!bqy!bq!P!bqX!bq!Z!bq#T!bqv!bq~O's(oO!P&`a!e&`aX&`a~O!i-_O!j-^O!l5_O'U-WOv&aX!e&aX~O!e1tOv'pa~O!S5aO~O!S5eO's(oOP$Xa!e$Xa~O(P*OOP$Wq!e$Wq~Ov$^i!e$^i~P2gOw!POy5gO#S5iO$|*wO~Oo5lOy5kO(P*OO~Oy5nO~Oy5nO$|*wO~Oy5rO(P*OO~Ow!POy5gO~Oo5yOy5xO(P*OO~O!S5{O~O!e2tO!P(ta~O^2zO!j2yO'[%eO~OQ!QOZ%rO[%qO^.qO_%cO`TOaTOd%jOg%yO}%pO!j.rO!q.oO!t6PO#V6RO$f%wO%^%xO&W%{O'R#VO'U%dO'[%eO(Q%zO!P&xX!e&xX~PGaOQ!QOZ%rO[%qO^6TO_%cO`TOaTOd%jOg%yO}%pO!j6UO!q%oO$f%wO%^%xO&W%{O'U%dO'[%eO(P)}O(Q%zO~PGaO!P%aa!e%aa~P#4_O^6VO~O#S6WOR%wq#p%wq(P%wqw%wq$f%wq$|%wq[%wqo%wqy%wq}%wq!l%wq!q%wq!t%wq#Q%wq#R%wq'h%wq'r%wq's%wq'x%wq'y%wq'z%wq'{%wq'|%wq'}%wq(O%wq(Q%wq(R%wq(T%wq!P%wq!e%wqX%wqP%wqv%wq!S%wq#T%wq~O(P*OOR&Oq#p&Oqw&Oq$f&Oq$|&Oq[&Oqo&Oqy&Oq}&Oq!l&Oq!q&Oq!t&Oq#Q&Oq#R&Oq'h&Oq'r&Oq's&Oq'x&Oq'y&Oq'z&Oq'{&Oq'|&Oq'}&Oq(O&Oq(Q&Oq(R&Oq(T&Oq!P&Oq!e&OqX&OqP&Oqv&Oq!S&Oq#T&Oq~O(P*OO!P&ya!e&ya~OX6XO~P2gO'[%eOR&wX!e&wX~O!e3SOR(ra~O$f6_O(P*OO~Ow![q~P#9jO#T6bO~O!Z3bO#T6bO's(oO~Ov6gO~O!S1_O#T'wX~O#T6kO~Oy6lO!P6mO~O!P6mO~P&']Oy6pO~Ov6pOy6lO~Ov6pO~P&']Oy6rO~O!e3yOv(da~O!S6uO~Oa/yO|!VO'R#VO'U(QOv&oX!e&oX~O!e4OO(P*OO!P(fa~OQ!QOZ%rO[%qO^%vO_%cO`TOa/yOd%jOg%yO|!VO}%pO!q%oO$f%wO%^%xO&W%{O'R#VO'U%dO'[%eO(Q%zO!P&pX!e&pX~PGaO!e4OO!P(fa~OQ!QOZ%rO[%qO^%vO_%cO`TOaTOd%jOg%yO}%pO!q%oO$f0UO%^%xO&W%{O'U%dO'[%eO(Q%zOw&nX!e&nXy&nX~PGaO!e4TOw(aay(aa~O!e4]Ov(ha~Oo7XOv%Xa!e%Xa~Oo7XOw*uO}*vOv%Xa!e%Xa~Oa/yO|!VO'R#VO'U*nOv&qX!e&qX~O(P*OOy$xaw$xa$|$xaR$xao$xa!e$xa~O(P4aOy(_aw(_a$|(_aR(_ao(_a!e(_a~O!P%aa!S!aX!e%aa's!aX~P!KZOQ!QO[$gO^7`O_$ZO`:QOa:QOd$aO}$eO!i$qO!j&bO!l$lO!q$hO#V$lO'U$YO'h$[O~P%;dO^6VO!j6UO~O!e4jO!P(ka~O!e4jO!P(ka!S'fX's'fX~OQ!QO[$gO^0kO_$ZO`:QOa:QOd$aO}$eO!i$qO!j0lO!l$lO!q0dO!t7dO#V7fO'R#VO'U$YO'[%eO'h$[O!P&sX!e&sX~P%;dO!S7hO's(oO~Ow!POy5gO$|*wO(P*OO~O!S+TOR&la!e&la~Oo0vO!S+TOR&la!e&la~Oo0vOR&la!e&la~O(P*OOR$yi!e$yi~Oy7kO~P2gOo7lOy7kO(P*OO~O(P*OORni!eni~O(P*OOR&va!e&va~O(P)}OR&va!e&va~OS,_OT,_OZ,_O_,_Od,_Oo,_Os,_Ou,_Oy,_O!S,_O!e,_O!l,_O!q,]O!t,_O!{,_O#Q,_O#R,_O#S,_O#T,_O'R,_O'[%eO'_UO'h,[O's,]O'x,[O'y,]O'z,]O'{,]O'|,^O'},^O(O,_O~O(P7nO(Q7nO(R7nO~P''`O!P7pO~P#K_OSVOTVOsVOtVOuVO'_UO!P&zX!e&zX~P!6PO!e5XO!P(wa~O!P&ei!e&ei~P2gO's(oOv!hi!e!hi~O!S7tO~O(P*OOP$Xi!e$Xi~Ov$^q!e$^q~P2gOw!POy7vO~Ow!POy7vO#S7yO$|*wO~Oy7{O~Oy7|O~Oy7}O(P*OO~Ow!POy7vO$|*wO(P*OO~Oo8SOy8RO(P*OO~O!e2tO!P(ti~O(P*OO!P%}X!e%}X~O!P%ai!e%ai~P#4_O^8VO~O!e8[O['cXv$`i}'cX!l'cX!q'cX!t'cX'h'cX'r'cX(Q'cX~P@[OQ#[iS#[iT#[i[#[i^#[i_#[i`#[ia#[id#[is#[it#[iu#[iv$`i}#[i!i#[i!j#[i!l#[i!q#[i!t'cX#V#[i'R#[i'U#[i'_#[i'h#[i'r'cX(Q'cX~P@[O#T#^a~P2gO#T8_O~O!Z3bO#T8`O's(oO~Ov8cO~Oy8eO~P2gOy8gO~Oy6lO!P8hO~Ov8gOy6lO~O!e3yOv(di~O(P*OOv%Qi!e%Qi~O!e4OO!P(fi~O!e4OO(P*OO!P(fi~O(P*OO!P&pa!e&pa~O(P8oOw(bX!e(bXy(bX~O(P*OO!S$wiy$wiw$wi$|$wiR$wio$wi!e$wi~O!e4]Ov(hi~Ov%Xi!e%Xi~P2gOo8rOv%Xi!e%Xi~O!P%ai!S!aX!e%ai's!aX~P!KZO(P*OO!P%`i!e%`i~O!e4jO!P(ki~OQ!QO[$gO^0kO_$ZO`:QOa:QOd$aO}$eO!i$qO!j0lO!l$lO!q0dO!t7dO#V8uO'R#VO'U$YO'[%eO'h$[O~P%;dO!P&sa!S'fX!e&sa's'fX~O(P*OOR$zq!e$zq~Oy8wO~P2gOy8RO~P2gO(P8yO(Q8yO(R8yO~O(P8yO(Q8yO(R8yO~P''`O's(oOv!hq!e!hq~O(P*OOP$Xq!e$Xq~Ow!POy8|O$|*wO(P*OO~Ow!POy8|O~Oy9PO~P2gOy9RO~P2gOo9TOy9RO(P*OO~OQ#[qS#[qT#[q[#[q^#[q_#[q`#[qa#[qd#[qs#[qt#[qu#[qv$`q}#[q!i#[q!j#[q!l#[q!q#[q#V#[q'R#[q'U#[q'_#[q'h#[q~O!e9WO['cXv$`q}'cX!l'cX!q'cX!t'cX'h'cX'r'cX(Q'cX~P@[Oo'cX!t'cX#Q'cX#R'cX#p'cX'r'cX's'cX'x'cX'y'cX'z'cX'{'cX'|'cX'}'cX(O'cX(P'cX(Q'cX(R'cX(T'cX~P'9OO#T9]O~O!Z3bO#T9]O's(oO~Oy9_O~O(P*OOv%Qq!e%Qq~O!e4OO!P(fq~O(P*OO!P&pi!e&pi~O(P8oOw(ba!e(bay(ba~Ov%Xq!e%Xq~P2gO!P&si!S'fX!e&si's'fX~O(P*OO!P%`q!e%`q~Oy9dO~P2gO(P9eO(Q9eO(R9eO~O's(oOv!hy!e!hy~Ow!POy9fO~Ow!POy9fO$|*wO(P*OO~Oy9hO~P2gOQ#[yS#[yT#[y[#[y^#[y_#[y`#[ya#[yd#[ys#[yt#[yu#[yv$`y}#[y!i#[y!j#[y!l#[y!q#[y#V#[y'R#[y'U#[y'_#[y'h#[y~O!e9kO['cXv$`y}'cX!l'cX!q'cX!t'cX'h'cX'r'cX(Q'cX~P@[Oo'cX!t'cX#Q'cX#R'cX#p'cX'r'cX's'cX'x'cX'y'cX'z'cX'{'cX'|'cX'}'cX(O'cX(P'cX(Q'cX(R'cX(T'cX~P'?}O!e9lO['cX}'cX!l'cX!q'cX!t'cX'h'cX'r'cX(Q'cX~P@[OQ#[iS#[iT#[i[#[i^#[i_#[i`#[ia#[id#[is#[it#[iu#[i}#[i!i#[i!j#[i!l#[i!q#[i!t'cX#V#[i'R#[i'U#[i'_#[i'h#[i'r'cX(Q'cX~P@[O#T9oO~O(P*OO!P&pq!e&pq~Ov%Xy!e%Xy~P2gOw!POy9pO~Oy9qO~P2gOQ#[!RS#[!RT#[!R[#[!R^#[!R_#[!R`#[!Ra#[!Rd#[!Rs#[!Rt#[!Ru#[!Rv$`!R}#[!R!i#[!R!j#[!R!l#[!R!q#[!R#V#[!R'R#[!R'U#[!R'_#[!R'h#[!R~O!e9rO['cX}'cX!l'cX!q'cX!t'cX'h'cX'r'cX(Q'cX~P@[OQ#[qS#[qT#[q[#[q^#[q_#[q`#[qa#[qd#[qs#[qt#[qu#[q}#[q!i#[q!j#[q!l#[q!q#[q!t'cX#V#[q'R#[q'U#[q'_#[q'h#[q'r'cX(Q'cX~P@[O!e9uO['cX}'cX!l'cX!q'cX!t'cX'h'cX'r'cX(Q'cX~P@[OQ#[yS#[yT#[y[#[y^#[y_#[y`#[ya#[yd#[ys#[yt#[yu#[y}#[y!i#[y!j#[y!l#[y!q#[y!t'cX#V#[y'R#[y'U#[y'_#[y'h#[y'r'cX(Q'cX~P@[OwbX~P$|OwjX}jX!tbX'rbX~P!6mOZ'TXd'YXo'TXw'lX!t'TX'r'TX's'TX~O['TXd'TXw'TX}'TX!l'TX!q'TX#Q'TX#R'TX#p'TX'h'TX'x'TX'y'TX'z'TX'{'TX'|'TX'}'TX(O'TX(P'TX(Q'TX(R'TX(T'TX~P'MmOP'TX}'lX!S'TX!e'TX!O'TXy'TX!P'TXX'TX!Z'TX#T'TXv'TX~P'MmO^9xO_9xO`9xOa9xO'U9vO~O!j:VO~P!.cOPoOQ!QOZeO^9xO_9xO`9xOa9xOd9{O!U#bO!W#cO!X;RO!Z!YO#Y!_O#r:RO#{:SO$O!]O$b!`O$d!bO$f!cO'U9vO'[kO[#sXo#sXw#sX}#sX!l#sX!q#sX!t#sX#Q#sX#R#sX#p#sX'h#sX'r#sX's#sX'x#sX'y#sX'z#sX'{#sX'|#sX'}#sX(O#sX(P#sX(Q#sX(R#sX(T#sX~P%;dO#S$uO~P!.cO}'lXP'TX!S'TX!e'TX!O'TXy'TX!P'TXX'TX!Z'TX#T'TXv'TX~P'MmOo#qX#Q#qX#R#qX#p#qX's#qX'x#qX'y#qX'z#qX'{#qX'|#qX'}#qX(O#qX(P#qX(R#qX(T#qX~P!.cOo#zX#Q#zX#R#zX#p#zX's#zX'x#zX'y#zX'z#zX'{#zX'|#zX'}#zX(O#zX(P#zX(R#zX(T#zX~P!.cOPoOQ!QOZeO^9xO_9xO`9xOa9xOd9{O!U#bO!W#cO!X;RO!Z!YO#Y!_O#r:RO#{:SO$O!]O$b!`O$d!bO$f!cO'U9vO'[kO[#sao#saw#sa}#sa!l#sa!q#sa!t#sa#Q#sa#R#sa#p#sa'h#sa'r#sa's#sa'x#sa'y#sa'z#sa'{#sa'|#sa'}#sa(O#sa(P#sa(Q#sa(R#sa(T#sa~P%;dOo:aO#Q:aO#R:^Ow#sa~P!BqOw$Ua~P#9jOQ'YXd'YX}iX~OQlXdlX}jX~O^:zO_:zO`:zOa:zO'U:fO~OQ'YXd'YX}hX~Ow#qa~P#9jOw#za~P#9jO!S&_Oo#za#Q#za#R#za#p#za's#za'x#za'y#za'z#za'{#za'|#za'}#za(O#za(P#za(R#za(T#za~P!.cO#S*dO~P!.cOw#ci~P#9jO[#}O}#zO'x#hO(O#|O(Q#hO(R#fO(T#hOo#eiw#ei!l#ei!q#ei!t#ei#Q#ei#R#ei#p#ei'r#ei's#ei'y#ei'z#ei'{#ei'|#ei'}#ei~O'h#ei(P#ei~P(/aO'h#gO(P#gO~P(/aO[#}O}#zO'h#gO'x#hO'y#iO'z#iO(O#|O(P#gO(Q#hO(R#fO(T#hOo#eiw#ei!l#ei!t#ei#Q#ei#R#ei#p#ei'r#ei's#ei'{#ei'|#ei'}#ei~O!q#ei~P(1]O!q#jO~P(1]O[#}O}#zO!q#jO'h#gO'x#hO'y#iO'z#iO'{#kO(O#|O(P#gO(Q#hO(R#fO(T#hOo#eiw#ei!l#ei!t#ei#Q#ei#R#ei#p#ei'r#ei'|#ei'}#ei~O's#ei~P(3UO's#lO~P(3UO[#}O}#zO!q#jO#R:^O'h#gO's#lO'x#hO'y#iO'z#iO'{#kO(O#|O(P#gO(Q#hO(R#fO(T#hOo#eiw#ei!l#ei!t#ei#Q#ei#p#ei'r#ei'|#ei~O'}#ei~P(4}O'}#mO~P(4}Oo:aO#Q:aO#R:^Ow#ni~P$1lOo:aO#Q:aO#R:^Ow#si~P$3mOQ'YXd'YX}'lX~Ow#zi~P#9jOw$Ui~P#9jOd:UO~Ow#ca~P#9jOd:|O~OU'x_'v'Q'P'_s!{'_'U'[~",
  goto: "$L^(xPPPPPPP(yPP)QPP)`PPPP)l-rP0r5oP7a7a9U7a?VDoEQPEWHaPPPPPPKqP! b! pPPPPP!!hP!%QP!%QPP!'QP!)TP!)Y!*P!*w!*w!*w!)Y!+nP!)Y!.c!.fPP!.lP!)Y!)Y!)Y!)YP!)Y!)YP!)Y!)Y!/[!/[!/y!0hP!0hKaKaKaPPPP!0hPP!%QP!0v!0y!1P!2Q!2^!4^!4^!6[!8^!2^!2^!:Y!;w!=h!?T!@n!BV!Cl!D}!2^!2^P!2^P!2^!2^!F^!2^P!G}!2^!2^P!I}!2^P!2^!8^!8^!2^!8^!2^!LU!N^!Na!8^!2^!Nd!Ng!Ng!Ng!Nk!%QP!%QP!%QP! b! bP!Nu! b! bP# R#!g! bP! bP#!v##{#$T#$s#$w#$}#$}#%VP#']#']#'c#(X#(e! bP! bP#(u#)U! bP! bPP#)b#)p#)|#*f#)v! b! bP! b! b! bP#*l#*l#*r#*x#*l#*l! b! bP#+V#+`#+j#+j#-b#/U#/b#/b#/e#/e5o5o5o5o5o5o5o5oP5o#/h#/n#0Y#2e#2k#2z#6x#7O#7U#7h#7r#9c#9m#9|#:S#:Y#:d#:n#:t#;R#;X#;_#;i#;w#<R#>a#>m#>z#?Q#?Y#?a#?k#?qPPPPPPP#?w#CTP#GS#Kn#Mi$ h$'UP$'XPPP$*`$*i$*{$0V$2e$2n$4gP!)Y$5a$8u$;l$?W$?a$?f$?iPPP$?l$BcP$BsPPPPPPPPPP$CXP$Eg$Ej$Em$Es$Ev$Ey$E|$FP$FV$Ha$Hd$Hg$Hj$Hm$Hp$Hs$Hv$Hy$H|$IP$KV$KY$K]#*l$Ki$Ko$Kr$Ku$Ky$K}$LQ$LT$LW$LZQ!tPT'V!s'Wi!SOlm!P!T$T$W$y%b)T*e/fQ'h#QQ,l'kQ1d,kR7q5X(SSOY[bfgilmop!O!P!T!Y!Z![!_!`!c!p!q!|!}#Q#U#Z#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W$`$a$e$g$h$q$r$y%X%_%b&U&Y&[&b&u&z&|'P'a'k'm'n'|(V(X(a(c(d(e(i(n(o(q({)R)T)h*Y*e*h*j*k+Y+m+y,k,o,r,y-Q-S-f-l-s.|/]/a/c/f0d0f0l0|1O1i1s1}3`3b3g3i3l4Y4e4j4x5O5X5a5l5y6b6f7X7c7l7t8S8_8`8r9T9]9o9z9{9|9}:O:P:R:S:T:U:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m:nS(y$v-nQ*o&eQ*s&hQ-j(xQ-x)YW0Y+P0X4]7ZR4[0Z&{!RObfgilmop!O!P!T!Y!Z![!_!`!c!p#Q#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W$e$g$h$q$r$y%_%b&U&Y&[&b&u'k'|(V(X(a(e(i(n(o(q({)R)T)h*Y*e*h*j*k+Y+m,k,r,y-S-f-l-s.|/]/a/c/f0d0f0l0|1i1s1}3`3b3g3i3l4Y4e4j4x5O5X5a5l5y6b6f7X7c7l7t8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m#r]Ofgilmp!O!P!T!Z![#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h+m,r,y-l.|0|1i1}3`3b3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9of#[b#Q$y'k(a)R)T*Y,k-s5X!h$bo!c!p$e$g$h$q$r&U&b&u(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7t$b%k!Q!n$O$u%o%p%q%y%{&P&o&p&r'](p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8n!W;Q!Y!_!`*h*k/]3i9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:mR;T%n$_%u!Q!n$O$u%o%p%q&P&o&p&r'](p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8n$e%l!Q!n$O$u%n%o%p%q%y%{&P&o&p&r'](p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8n'hZOY[fgilmop!O!P!T!Y!Z![!_!`!c!p!|!}#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W$`$a$e$g$h$q$r%_%b%i%j&U&Y&[&b&u'a'|(V(X(c(d(e(i(n(o(q({)h)o)p*e*h*j*k+Y+m,r,y-Q-S-f-l.h.|/]/a/c/f0d0f0l0|1i1s1}3`3b3g3i3l4Y4e4j4x5O5a5l5y6b6f7X7c7l7t8S8_8`8r9T9]9o9z9{9|9}:O:P:R:S:T:U:V:W:X:Y:Z:[:]:^:_:`:a:b:g:h:l:m:n:{:|;P$^%l!Q!n$O$u%n%o%p%q%y%{&P&p&r(p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8nQ&j!hQ&k!iQ&l!jQ&m!kQ&s!oQ)Z%QQ)[%RQ)]%SQ)^%TQ)a%WQ+_&oS,Q']1YQ.V)_S/q*t4VR4p0r+}TOY[bfgilmop!O!P!Q!T!Y!Z![!_!`!c!n!p!q!|!}#Q#U#Z#e#o#p#q#r#s#t#u#v#w#x#y#z#}$O$T$W$`$a$e$g$h$q$r$u$y%X%_%b%i%j%n%o%p%q%y%{&P&U&Y&[&b&o&p&r&u&z&|'P']'a'k'm'n'|(V(X(a(c(d(e(i(n(o(p(q({)R)T)h)o)p)r)w)x)}*O*Q*U*Y*Z*]*d*e*h*j*k*m*v*w+T+U+Y+g+m+n+y+|,k,o,r,y-Q-S-f-h-l-s-u.T._.h.o.s.w.x.|/Y/Z/]/a/c/f/z/|0_0d0f0l0q0v0|0}1O1X1Y1i1s1z1}2b2i2k2n2t2w3W3`3b3g3i3l3w3}4O4T4W4Y4a4e4g4j4v4x5O5X5a5e5i5l5y5{6W6_6b6f6u6{6}7X7c7h7l7t7y8S8_8`8n8r9T9]9o9z9{9|9}:O:P:R:S:T:U:V:W:X:Y:Z:[:]:^:_:`:a:b:g:h:l:m:n:{:|;PQ'[!xQ'g#PQ)k%gU)q%m*S*VR.e)jQ,S']R5R1Y#t%s!Q!n$O$u%p%q&P&p&r(p)w)x)}*Q*U*Z*]*d*m*v+U+g+n+|-h-u.T._.s.w.x/Y/Z/z/|0_0q0v0}1X1z2b2i2k2n2w3W3w3}4O4W4g4v5e5i5{6W6_6u6{6}7h7y8nQ)w%oQ+^&oQ,T']l,_'b'c'd,Y,e,f/l/m1`3p3s5V5W7pS.p)r2tQ.}*OQ/P*RQ/p*tS0P*w4TQ0`+T[0n+Y.i0f4j6O7cQ2w.oS4f0d2sQ4o0rQ5S1YQ6Y3SQ7P4RQ7T4VQ7^4aR9a8o&pVOfgilmop!O!P!T!Y!Z![!_!`!c!p#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W$e$g$h$q$r%_%b&U&Y&[&b&u']'|(V(X(a(e(i(n(o(q({)h*e*h*j*k+Y+m,j,k,r,y-S-f-l.|/]/a/c/f0d0f0l0|1Y1i1s1}3`3b3g3i3l4Y4e4j4x5O5X5a5l5y6b6f7X7c7l7t8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:mU&g!g%P%[m,_'b'c'd,Y,e,f/l/m1`3p3s5V5W7p$nsOfgilm!O!P!T!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y'|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:R:S:V:W:X:Y:Z:[:]:^:_:`:a:lS$tp:PS&O!W#bS&Q!X#cQ&`!bQ*^&RQ*`&VS*c&[:mQ*g&^Q,S']Q-i(vQ/h*iQ0o+ZS2g.W0pQ3^/^Q3_/_Q3h/gQ3j/jQ5R1YU5g2S2h4nU7v5h5j5wQ8d6iS8|7w7xS9f8}9OR9p9gi{Ob!O!P!T$y%_%b)R)T)h-shxOb!O!P!T$y%_%b)R)T)h-sW/u*u/s3y6vQ/|*vW0Z+P0X4]7ZQ3}/zQ6}4OR8n6{!h$do!c!p$e$g$h$q$r&U&b&u(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7tQ&d!dQ&f!fQ&n!mW&x!q%X&|1OQ'S!rQ)W$}Q)X%OQ)`%VU)c%Y'T'UQ*r&hS+r&z'PS-X(j1tQ-t)VQ-w)YS.`)d)eS0w+b/rQ1R+yQ1V+zS1w-^-_Q2l.aQ3u/oQ5b1yR5m2W${sOfgilmp!O!P!T!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m$zsOfgilmp!O!P!T!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:mR3^/^V&T!Y!`*h!i$lo!c!p$e$g$h$q$r&U&b&u(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7t!k$^o!c!p$e$g$h$q$r&U&b&u(a(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7t!i$co!c!p$e$g$h$q$r&U&b&u(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7t&e^Ofgilmop!O!P!T!Y!Z![!_!`!c!p#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W$e$g$h$q$r%_%b&U&Y&[&b&u'|(V(X(e(i(n(o(q({)h*e*h*j*k+Y+m,r,y-S-f-l.|/]/a/c/f0d0f0l0|1i1s1}3`3b3g3i3l4Y4e4j4x5O5a5l5y6b6f7X7c7l7t8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:mR(k$fQ-Z(jR5_1tQ(R#|S(z$v-nS-Y(j1tQ-k(xW/t*u/s3y6vS1x-^-_Q3x/uR5c1yQ'e#Oh,b'b'c'd,Y,e,f/l/m1`3p3s5WQ,m'lQ,p'oQ.t)tR8f6kQ'f#Oh,b'b'c'd,Y,e,f/l/m1`3p3s5WQ,n'lQ,p'oQ.t)tR8f6ki,b'b'c'd,Y,e,f/l/m1`3p3s5WR*f&]X/b*e/c/f3g!}aOb!O!P!T#z$v$y%_%b'|(x)R)T)h)r*e*u*v+P+Y,r-n-s.i/a/c/f/s/z0X0f1i2t3g3y4O4]4j6O6f6v6{7Z7cQ3a/`Q6d3cQ8a6eR9^8b${rOfgilmp!O!P!T!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m#nfOfglmp!O!P!T!Z![#e#o#p#q#r#s#t#u#v#w#x#z#}$T$W%_%b&Y&['|(V(X({)h+m,r,y-l.|0|1i1}3`3b3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o!T9|!Y!_!`*h*k/]3i9|9}:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:l:m#rfOfgilmp!O!P!T!Z![#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h+m,r,y-l.|0|1i1}3`3b3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o!X9|!Y!_!`*h*k/]3i9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m$srOfglmp!O!P!T!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#z#}$T$W%_%b&Y&['|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:l:m#U#oh#d$P$Q$V$s%^&W&X'p's't'u'v'w'x'y'z'{'}(T(Z(_*a*b,q,v,x-m0y1j1m2O3Q4y5[5f6c6j7W7j7m7z8Q8q8x9S9c9i}:W&S&]/j3]6i:c:d:j:k:o:q:r:s:t:u:v:w:x:y:};O;S#W#ph#d$P$Q$V$s%^&W&X'p'q's't'u'v'w'x'y'z'{'}(T(Z(_*a*b,q,v,x-m0y1j1m2O3Q4y5[5f6c6j7W7j7m7z8Q8q8x9S9c9i!P:X&S&]/j3]6i:c:d:j:k:o:p:q:r:s:t:u:v:w:x:y:};O;S#S#qh#d$P$Q$V$s%^&W&X'p't'u'v'w'x'y'z'{'}(T(Z(_*a*b,q,v,x-m0y1j1m2O3Q4y5[5f6c6j7W7j7m7z8Q8q8x9S9c9i{:Y&S&]/j3]6i:c:d:j:k:o:r:s:t:u:v:w:x:y:};O;S#Q#rh#d$P$Q$V$s%^&W&X'p'u'v'w'x'y'z'{'}(T(Z(_*a*b,q,v,x-m0y1j1m2O3Q4y5[5f6c6j7W7j7m7z8Q8q8x9S9c9iy:Z&S&]/j3]6i:c:d:j:k:o:s:t:u:v:w:x:y:};O;S#O#sh#d$P$Q$V$s%^&W&X'p'v'w'x'y'z'{'}(T(Z(_*a*b,q,v,x-m0y1j1m2O3Q4y5[5f6c6j7W7j7m7z8Q8q8x9S9c9iw:[&S&]/j3]6i:c:d:j:k:o:t:u:v:w:x:y:};O;S!|#th#d$P$Q$V$s%^&W&X'p'w'x'y'z'{'}(T(Z(_*a*b,q,v,x-m0y1j1m2O3Q4y5[5f6c6j7W7j7m7z8Q8q8x9S9c9iu:]&S&]/j3]6i:c:d:j:k:o:u:v:w:x:y:};O;S!x#vh#d$P$Q$V$s%^&W&X'p'y'z'{'}(T(Z(_*a*b,q,v,x-m0y1j1m2O3Q4y5[5f6c6j7W7j7m7z8Q8q8x9S9c9iq:_&S&]/j3]6i:c:d:j:k:o:w:x:y:};O;S!v#wh#d$P$Q$V$s%^&W&X'p'z'{'}(T(Z(_*a*b,q,v,x-m0y1j1m2O3Q4y5[5f6c6j7W7j7m7z8Q8q8x9S9c9io:`&S&]/j3]6i:c:d:j:k:o:x:y:};O;S$]#{h#`#d$P$Q$V$s%^&S&W&X&]'p'q'r's't'u'v'w'x'y'z'{'}(T(Z(_*a*b,q,v,x-m/j0y1j1m2O3Q3]4y5[5f6c6i6j7W7j7m7z8Q8q8x9S9c9i:c:d:j:k:o:p:q:r:s:t:u:v:w:x:y:};O;S${jOfgilmp!O!P!T!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m$v!aOfgilmp!O!P!T!Y!Z!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:O:P:R:V:W:X:Y:Z:[:]:^:_:`:a:b:l:mQ&Y![Q&Z!]R:l:S#rpOfgilmp!O!P!T!Z![#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h+m,r,y-l.|0|1i1}3`3b3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9oQ&[!^!W:P!Y!_!`*h*k/]3i9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:mR:m;RR$moR-e(qR$wqT(|$v-nQ/e*eS3e/c/fR6h3gQ3o/lQ3r/mQ6n3pR6q3sQ$zwQ)U${Q*p&fQ+e&qQ+h&sQ-v)XW.Y)a+i+j+kS/W*[+fW2c.V.Z.[.]U3X/X/[0xU5t2d2e2fS6]3Y3[S8O5u5vS8X6[6^Q9Q8PS9U8Y8ZR9j9V^|O!O!P!T%_%b)hX)Q$y)R)T-sQ&r!nQ*]&PQ*{&jQ+O&kQ+S&lQ+V&mQ+[&nQ+k&sQ-|)ZQ.P)[Q.S)]Q.U)^Q.X)`Q.])aQ2T-tQ2f.VR4W0UU+`&o*t4VR4q0rQ+X&mQ+j&sS.[)a+k^0u+^+_/p/q4o4p7TS2e.V.]S4S0Q0RR5v2fS0Q*w4TQ0`+TR7^4aU+c&o*t4VR4r0rQ*y&jQ*}&kQ+R&lQ+f&qQ+i&sS-z)Z*{S.O)[+OS.R)]+SU.Z)a+j+kQ/X*[Q0W*zQ0p+ZQ2Y-{Q2Z-|Q2^.PQ2`.SU2d.V.[.]Q2h.WS3[/[0xS5h2S4nQ5o2[S5u2e2fQ6^3YS7x5j5wQ8P5vQ8Y6[Q8}7wQ9V8ZR9g9OQ0S*wR7R4TQ*x&jQ*|&kU-y)Z*y*{U-})[*}+OS2X-z-|S2].O.PQ4Z0YQ5n2ZQ5p2^R7Y4[Q/v*uQ3v/sQ6w3yR8k6vQ*z&jS-{)Z*{Q2[-|Q4Z0YR7Y4[Q+Q&lU.Q)]+R+SS2_.R.SR5q2`Q0[+PQ4X0XQ7[4]R8s7ZQ+Z&nS.W)`+[S2S-t.XR5j2TQ0h+YQ4h0fQ7e4jR8t7cQ.l)rQ0h+YQ2q.iQ4h0fQ6R2tQ7e4jQ8U6OR8t7cQ0h+YR4h0fX'O!q%X&|1OX&{!q%X&|1OW'O!q%X&|1OS+t&z'PR1T+y_|O!O!P!T%_%b)hQ%a!PS)g%_%bR.c)h$^%u!Q!n$O$u%o%p%q&P&o&p&r'](p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8nQ*T%yR*W%{$c%n!Q!n$O$u%o%p%q%y%{&P&o&p&r'](p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8nW)s%m%x*S*VQ.d)iR2|.uR.l)rR6R2tQ'W!sR+}'WQ!TOQ$TlQ$WmQ%b!P[%|!T$T$W%b)T/fQ)T$yR/f*e$b%i!Q!n$O$u%o%p%q%y%{&P&o&p&r'](p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8n[)m%i)o.h:g:{;PQ)o%jQ.h)pQ:g%nQ:{:hR;P:|Q!vUR'Y!vS!OO!TU%]!O%_)hQ%_!PR)h%b#rYOfgilmp!O!P!T!Z![#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h+m,r,y-l.|0|1i1}3`3b3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9oh!yY!|#U$`'a'm(c,o-Q9z:T:nQ!|[f#Ub#Q$y'k(a)R)T*Y,k-s5X!h$`o!c!p$e$g$h$q$r&U&b&u(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7tQ'a!}Q'm#ZQ(c$aQ,o'nQ-Q(d!W9z!Y!_!`*h*k/]3i9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:mQ:T9{R:n:UQ-T(fR1q-TQ1u-ZR5`1uQ,Y'bQ,e'cQ,f'dW1^,Y,e,f5WR5W1`Q/c*eS3d/c3gR3g/ffbO!O!P!T$y%_%b)R)T)h-sp#Wb'|(x.i/a/s/z0X0f1i6O6f6v6{7Z7cQ'|#zS(x$v-nQ.i)rW/a*e/c/f3gQ/s*uQ/z*vQ0X+PQ0f+YQ1i,rQ6O2tQ6v3yQ6{4OQ7Z4]R7c4jQ,s'}Q1h,qT1k,s1hS(W$Q(ZQ(]$VU,w(W(],|R,|(_Q(r$mR-g(rQ-o(}R2Q-oQ3p/lQ3s/mT6o3p3sQ)R$yS-q)R-sR-s)TQ4b0`R7_4b`0s+]+^+_+`+c/p/q7TR4s0sQ8p7PR9b8pQ4U0SR7S4UQ3z/vQ6s3vT6x3z6sQ4P/{Q6y3|U7O4P6y8lR8l6zQ4^0[Q7V4XT7]4^7VhzOb!O!P!T$y%_%b)R)T)h-sQ$|xW%Zz$|%f)u$b%f!Q!n$O$u%o%p%q%y%{&P&o&p&r'](p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8nR)u%nS4k0h0mS7b4h4iT7g4k7bW&z!q%X&|1OS+q&z+yR+y'PQ1P+vR4|1PU1Z,R,S,TR5T1ZS3T/P7TR6Z3TQ2u.lQ5}2qT6S2u5}Q.y)yR3P.yQ5Y1dR7r5Y^_O!O!P!T%_%b)hY#Xb$y)R)T-s$l#_fgilmp!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W&Y&['|(V(X({*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m!h$io!c!p$e$g$h$q$r&U&b&u(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7tW'i#Q'k,k5XQ-O(aR/U*Y&z!RObfgilmop!O!P!T!Y!Z![!_!`!c!p#Q#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W$e$g$h$q$r$y%_%b&U&Y&[&b&u'k'|(V(X(a(e(i(n(o(q({)R)T)h*Y*e*h*j*k+Y+m,k,r,y-S-f-l-s.|/]/a/c/f0d0f0l0|1i1s1}3`3b3g3i3l4Y4e4j4x5O5X5a5l5y6b6f7X7c7l7t8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m[!{Y[#U#Z9z9{W&{!q%X&|1O['`!|!}'m'n:T:US(b$`$aS+s&z'PU,W'a,o:nS-P(c(dQ1S+yR1o-QS%t!Q&oQ&q!nQ(U$OQ(v$uS)v%o.oQ)y%pQ)|%qS*[&P&rQ+d&pQ,R']Q-c(pQ.k)rU.v)w)x2wS.})}*OQ/O*QQ/S*UQ/V*ZQ/[*]Q/_*dQ/k*mQ/{*vS0R*w4TQ0`+TQ0b+UQ0x+gQ0z+nQ1W+|Q1|-hQ2U-uQ2a.TQ2j._Q2{.sQ2}.wQ3O.xQ3Y/YQ3Z/ZS3|/z/|Q4`0_Q4n0qQ4u0vQ4z0}Q5P1XQ5Q1YQ5d1zQ5s2bQ5w2iQ5z2kQ5|2nQ6Q2tQ6[3WQ6t3wQ6z3}Q6|4OQ7U4WQ7^4aQ7a4gQ7i4vQ7u5eQ7w5iQ8T5{Q8W6WQ8Z6_Q8j6uS8m6{6}Q8v7hQ9O7yR9`8n$^%m!Q!n$O$u%o%p%q&P&o&p&r'](p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8nQ)i%nQ*S%yR*V%{$y%h!Q!n$O$u%i%j%n%o%p%q%y%{&P&o&p&r'](p)o)p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.h.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8n:g:h:{:|;P'tWOY[bfgilmop!O!P!T!Y!Z![!_!`!c!p!|!}#Q#U#Z#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W$`$a$e$g$h$q$r$y%_%b&U&Y&[&b&u'a'k'm'n'|(V(X(a(c(d(e(i(n(o(q({)R)T)h*Y*e*h*j*k+Y+m,k,o,r,y-Q-S-f-l-s.|/]/a/c/f0d0f0l0|1i1s1}3`3b3g3i3l4Y4e4j4x5O5X5a5l5y6b6f7X7c7l7t8S8_8`8r9T9]9o9z9{9|9}:O:P:R:S:T:U:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m:n$x%g!Q!n$O$u%i%j%n%o%p%q%y%{&P&o&p&r'](p)o)p)r)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.h.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8n:g:h:{:|;P_&y!q%X&z&|'P+y1OR,U']$zrOfgilmp!O!P!T!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m!j$]o!c!p$e$g$h$q$r&U&b&u(a(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7tQ,S']Q1c,jQ1d,kQ5R1YR7q5X_}O!O!P!T%_%b)h^|O!O!P!T%_%b)hQ#YbX)Q$y)R)T-sbhO!O!T3`6b8_8`9]9oS#`f9|Q#dgQ$PiQ$QlQ$VmQ$spW%^!P%_%b)hU&S!Y!`*hQ&W!ZQ&X![Q&]!_Q'p#eQ'q#oS'r#p:XQ's#qQ't#rQ'u#sQ'v#tQ'w#uQ'x#vQ'y#wQ'z#xQ'{#yQ'}#zQ(T#}Q(Z$TQ(_$WQ*a&YQ*b&[Q,q'|Q,v(VQ,x(XQ-m({Q/j*kQ0y+mQ1j,rQ1m,yQ2O-lQ3Q.|Q3]/]Q4y0|Q5[1iQ5f1}Q6c3bQ6i3iQ6j3lQ7W4YQ7j4xQ7m5OQ7z5lQ8Q5yQ8q7XQ8x7lQ9S8SQ9c8rQ9i9TQ:c:OQ:d:PQ:j:RQ:k:SQ:o:VQ:p:WQ:q:YQ:r:ZQ:s:[Q:t:]Q:u:^Q:v:_Q:w:`Q:x:aQ:y:bQ:}:lQ;O:mR;S9}^tO!O!P!T%_%b)h$`#afgilmp!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W&Y&['|(V(X({*h*k+m,r,y-l.|/]0|1i1}3b3i3l4Y4x5O5l5y7X7l8S8r9T9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:mQ6a3`Q8^6bQ9Y8_Q9[8`Q9n9]R9t9oQ&V!YQ&^!`R/g*hQ$joQ&a!cQ&t!pU(f$e$g(iS(m$h0dQ(t$qQ(u$rQ*_&UQ*l&bQ+o&uQ-R(eS-a(n4eQ-b(oQ-d(qW/`*e/c/f3gQ/i*jW0e+Y0f4j7cQ1p-SQ1{-fQ3c/aQ4m0lQ5^1sQ7s5aQ8b6fR8{7t!h$_o!c!p$e$g$h$q$r&U&b&u(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7tR-O(a'uXOY[bfgilmop!O!P!T!Y!Z![!_!`!c!p!|!}#Q#U#Z#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W$`$a$e$g$h$q$r$y%_%b&U&Y&[&b&u'a'k'm'n'|(V(X(a(c(d(e(i(n(o(q({)R)T)h*Y*e*h*j*k+Y+m,k,o,r,y-Q-S-f-l-s.|/]/a/c/f0d0f0l0|1i1s1}3`3b3g3i3l4Y4e4j4x5O5X5a5l5y6b6f7X7c7l7t8S8_8`8r9T9]9o9z9{9|9}:O:P:R:S:T:U:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m:n$zqOfgilmp!O!P!T!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m!i$fo!c!p$e$g$h$q$r&U&b&u(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7t&d^Ofgilmop!O!P!T!Y!Z![!_!`!c!p#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W$e$g$h$q$r%_%b&U&Y&[&b&u'|(V(X(e(i(n(o(q({)h*e*h*j*k+Y+m,r,y-S-f-l.|/]/a/c/f0d0f0l0|1i1s1}3`3b3g3i3l4Y4e4j4x5O5a5l5y6b6f7X7c7l7t8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m[!zY[$`$a9z9{['_!|!}(c(d:T:UW)n%i%j:g:hU,V'a-Q:nW.g)o)p:{:|T2p.h;PQ(h$eQ(l$gR-V(iV(g$e$g(iR-](jR-[(j$znOfgilmp!O!P!T!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W%_%b&Y&['|(V(X({)h*h*k+m,r,y-l.|/]0|1i1}3`3b3i3l4Y4x5O5l5y6b7X7l8S8_8`8r9T9]9o9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:m!i$ko!c!p$e$g$h$q$r&U&b&u(e(i(n(o(q*e*j+Y-S-f/a/c/f0d0f0l1s3g4e4j5a6f7c7t`,c'b'c'd,Y,e,f1`5WX3n/l/m3p3sh,b'b'c'd,Y,e,f/l/m1`3p3s5WQ7o5VR8z7p^uO!O!P!T%_%b)h$`#afgilmp!Y!Z![!_!`#e#o#p#q#r#s#t#u#v#w#x#y#z#}$T$W&Y&['|(V(X({*h*k+m,r,y-l.|/]0|1i1}3b3i3l4Y4x5O5l5y7X7l8S8r9T9|9}:O:P:R:S:V:W:X:Y:Z:[:]:^:_:`:a:b:l:mQ6`3`Q8]6bQ9X8_Q9Z8`Q9m9]R9s9oR(P#zR(O#zQ$SlR([$TR$ooR$noR)P$vR)O$vQ(}$vR2P-nhwOb!O!P!T$y%_%b)R)T)h-s$l!lz!Q!n$O$u$|%f%n%o%p%q%y%{&P&o&p&r'](p)r)u)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8nR${xR0a+TR0V*wR0T*wR7Q4RR/x*uR/w*uR0O*vR/}*vR0^+PR0]+P%XyObxz!O!P!Q!T!n$O$u$y$|%_%b%f%n%o%p%q%y%{&P&o&p&r'](p)R)T)h)r)u)w)x)}*O*Q*U*Z*]*d*m*v*w+T+U+g+n+|-h-s-u.T._.o.s.w.x/Y/Z/z/|0_0q0v0}1X1Y1z2b2i2k2n2t2w3W3w3}4O4T4W4a4g4v5e5i5{6W6_6u6{6}7h7y8nR0j+YR0i+YQ'R!qQ)b%XQ+v&|R4{1OX'Q!q%X&|1OR+x&|R+w&|T/R*R4VT/Q*R4VR.n)rR.m)rR)z%pR1f,kR1e,k",
  nodeNames: "\u26A0 | < > RawString Float LineComment BlockComment SourceFile ] InnerAttribute ! [ MetaItem self Metavariable super crate Identifier ScopedIdentifier :: QualifiedScope AbstractType impl SelfType MetaType TypeIdentifier ScopedTypeIdentifier ScopeIdentifier TypeArgList TypeBinding = Lifetime String Escape Char Boolean Integer } { Block ; ConstItem Vis pub ( in ) const BoundIdentifier : UnsafeBlock unsafe AsyncBlock async move IfExpression if LetDeclaration let LiteralPattern ArithOp MetaPattern SelfPattern ScopedIdentifier TuplePattern ScopedTypeIdentifier , StructPattern FieldPatternList FieldPattern ref mut FieldIdentifier .. RefPattern SlicePattern CapturedPattern ReferencePattern & MutPattern RangePattern ... OrPattern MacroPattern ParenthesizedTokens BracketedTokens BracedTokens TokenBinding Identifier TokenRepetition ArithOp BitOp LogicOp UpdateOp CompareOp -> => ArithOp _ else MatchExpression match MatchBlock MatchArm Attribute Guard UnaryExpression ArithOp DerefOp LogicOp ReferenceExpression TryExpression BinaryExpression ArithOp ArithOp BitOp BitOp BitOp BitOp LogicOp LogicOp AssignmentExpression TypeCastExpression as ReturnExpression return RangeExpression CallExpression ArgList AwaitExpression await FieldExpression GenericFunction BreakExpression break LoopLabel ContinueExpression continue IndexExpression ArrayExpression TupleExpression MacroInvocation UnitExpression ClosureExpression ParamList Parameter Parameter ParenthesizedExpression StructExpression FieldInitializerList ShorthandFieldInitializer FieldInitializer BaseFieldInitializer MatchArm WhileExpression while LoopExpression loop ForExpression for MacroInvocation MacroDefinition macro_rules MacroRule EmptyStatement ModItem mod DeclarationList AttributeItem ForeignModItem extern StructItem struct TypeParamList ConstrainedTypeParameter TraitBounds HigherRankedTraitBound RemovedTraitBound OptionalTypeParameter ConstParameter WhereClause where LifetimeClause TypeBoundClause FieldDeclarationList FieldDeclaration OrderedFieldDeclarationList UnionItem union EnumItem enum EnumVariantList EnumVariant TypeItem type FunctionItem default fn ParamList Parameter SelfParameter VariadicParameter VariadicParameter ImplItem TraitItem trait AssociatedType LetDeclaration UseDeclaration use ScopedIdentifier UseAsClause ScopedIdentifier UseList ScopedUseList UseWildcard ExternCrateDeclaration StaticItem static ExpressionStatement ExpressionStatement GenericType FunctionType ForLifetimes ParamList VariadicParameter Parameter VariadicParameter Parameter ReferenceType PointerType TupleType UnitType ArrayType MacroInvocation EmptyType DynamicType dyn BoundedType",
  maxTerm: 361,
  nodeProps: [
    [NodeProp.group, -42, 4, 5, 14, 15, 16, 17, 18, 19, 33, 35, 36, 37, 40, 51, 53, 56, 101, 107, 111, 112, 113, 122, 123, 125, 127, 128, 130, 132, 133, 134, 137, 139, 140, 141, 142, 143, 144, 148, 149, 155, 157, 159, "Expression", -16, 22, 24, 25, 26, 27, 222, 223, 230, 231, 232, 233, 234, 235, 236, 237, 239, "Type", -20, 42, 161, 162, 165, 166, 169, 170, 172, 188, 190, 194, 196, 204, 205, 207, 208, 209, 217, 218, 220, "Statement", -17, 49, 60, 62, 63, 64, 65, 68, 74, 75, 76, 77, 78, 80, 81, 83, 84, 99, "Pattern"],
    [NodeProp.openedBy, 9, "[", 38, "{", 47, "("],
    [NodeProp.closedBy, 12, "]", 39, "}", 45, ")"]
  ],
  skippedNodes: [0, 6, 7, 240],
  repeatNodeCount: 33,
  tokenData: "#CO_R!VOX$hXY1_YZ2ZZ]$h]^1_^p$hpq1_qr2srs4qst5Ztu6Vuv9lvw;jwx=nxy!#yyz!$uz{!%q{|!'k|}!(m}!O!)i!O!P!+j!P!Q!/f!Q!R!7q!R![!9f![!]!La!]!^!N_!^!_# Z!_!`##b!`!a#%c!a!b#'j!b!c#(f!c!}#)b!}#O#+X#O#P#,T#P#Q#4d#Q#R#5`#R#S#)b#S#T$h#T#U#)b#U#V#6b#V#f#)b#f#g#9u#g#o#)b#o#p#?S#p#q#@O#q#r#BS#r${$h${$|#)b$|4w$h4w5b#)b5b5i$h5i6S#)b6S~$hU$oZ'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$hU%iT'`Q'PSOz%xz{&^{!P%x!P!Q'S!Q~%xS%}T'PSOz%xz{&^{!P%x!P!Q'S!Q~%xS&aTOz&pz{&^{!P&p!P!Q({!Q~&pS&sTOz%xz{&^{!P%x!P!Q'S!Q~%xS'VSOz&p{!P&p!P!Q'c!Q~&pS'fSOz'r{!P'r!P!Q'c!Q~'rS'uTOz(Uz{(l{!P(U!P!Q'c!Q~(US(]T'QS'PSOz(Uz{(l{!P(U!P!Q'c!Q~(US(oSOz'rz{(l{!P'r!Q~'rS)QO'QSU)VZ'`QOY)xYZ+hZr)xrs&psz)xz{)Q{!P)x!P!Q0w!Q#O)x#O#P&p#P~)xU)}Z'`QOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$hU*uZ'`QOY)xYZ+hZr)xrs&psz)xz{+|{!P)x!P!Q,g!Q#O)x#O#P&p#P~)xU+mT'`QOz%xz{&^{!P%x!P!Q'S!Q~%xQ,RT'`QOY+|YZ,bZr+|s#O+|#P~+|Q,gO'`QU,lZ'`QOY-_YZ0cZr-_rs'rsz-_z{+|{!P-_!P!Q,g!Q#O-_#O#P'r#P~-_U-dZ'`QOY.VYZ/RZr.Vrs(Usz.Vz{/k{!P.V!P!Q,g!Q#O.V#O#P(U#P~.VU.`Z'`Q'QS'PSOY.VYZ/RZr.Vrs(Usz.Vz{/k{!P.V!P!Q,g!Q#O.V#O#P(U#P~.VU/[T'`Q'QS'PSOz(Uz{(l{!P(U!P!Q'c!Q~(UU/pZ'`QOY-_YZ0cZr-_rs'rsz-_z{/k{!P-_!P!Q+|!Q#O-_#O#P'r#P~-_U0hT'`QOz(Uz{(l{!P(U!P!Q'c!Q~(UU1OT'`Q'QSOY+|YZ,bZr+|s#O+|#P~+|_1hZ'`Q&}X'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_2dT'`Q&}X'PSOz%xz{&^{!P%x!P!Q'S!Q~%x_2|]ZX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`3u!`#O$h#O#P%x#P~$h_4OZ#RX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_4zT'^Q'PS'_XOz%xz{&^{!P%x!P!Q'S!Q~%x_5dZ'RX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_6`g'`Q'vW'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!c$h!c!}7w!}#O$h#O#P%x#P#R$h#R#S7w#S#T$h#T#o7w#o${$h${$|7w$|4w$h4w5b7w5b5i$h5i6S7w6S~$h_8Qh'`Q_X'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q![7w![!c$h!c!}7w!}#O$h#O#P%x#P#R$h#R#S7w#S#T$h#T#o7w#o${$h${$|7w$|4w$h4w5b7w5b5i$h5i6S7w6S~$h_9u](TP'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`:n!`#O$h#O#P%x#P~$h_:wZ#QX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_;s_!qX'`Q'PSOY$hYZ%bZr$hrs%xsv$hvw<rwz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`:n!`#O$h#O#P%x#P~$h_<{Z'}X'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_=ui'`Q'PSOY?dYZA`Zr?drsBdsw?dwx@dxz?dz{CO{!P?d!P!QDv!Q!c?d!c!}Et!}#O?d#O#PId#P#R?d#R#SEt#S#T?d#T#oEt#o${?d${$|Et$|4w?d4w5bEt5b5i?d5i6SEt6S~?d_?k]'`Q'PSOY$hYZ%bZr$hrs%xsw$hwx@dxz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_@mZ'`Q'PSsXOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_AgV'`Q'PSOw%xwxA|xz%xz{&^{!P%x!P!Q'S!Q~%x]BTT'PSsXOz%xz{&^{!P%x!P!Q'S!Q~%x]BiV'PSOw%xwxA|xz%xz{&^{!P%x!P!Q'S!Q~%x_CT]'`QOY)xYZ+hZr)xrs&psw)xwxC|xz)xz{)Q{!P)x!P!Q0w!Q#O)x#O#P&p#P~)x_DTZ'`QsXOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_D{]'`QOY)xYZ+hZr)xrs&psw)xwxC|xz)xz{+|{!P)x!P!Q,g!Q#O)x#O#P&p#P~)x_E}j'`Q'PS'[XOY$hYZ%bZr$hrs%xsw$hwx@dxz$hz{)Q{!P$h!P!Q*p!Q![Go![!c$h!c!}Go!}#O$h#O#P%x#P#R$h#R#SGo#S#T$h#T#oGo#o${$h${$|Go$|4w$h4w5bGo5b5i$h5i6SGo6S~$h_Gxh'`Q'PS'[XOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q![Go![!c$h!c!}Go!}#O$h#O#P%x#P#R$h#R#SGo#S#T$h#T#oGo#o${$h${$|Go$|4w$h4w5bGo5b5i$h5i6SGo6S~$h]IiX'PSOzBdz{JU{!PBd!P!QKS!Q#iBd#i#jKi#j#lBd#l#m!!a#m~Bd]JXVOw&pwxJnxz&pz{&^{!P&p!P!Q({!Q~&p]JsTsXOz%xz{&^{!P%x!P!Q'S!Q~%x]KVUOw&pwxJnxz&p{!P&p!P!Q'c!Q~&p]Kn['PSOz%xz{&^{!P%x!P!Q'S!Q![Ld![!c%x!c!iLd!i#T%x#T#ZLd#Z#o%x#o#pNq#p~%x]LiY'PSOz%xz{&^{!P%x!P!Q'S!Q![MX![!c%x!c!iMX!i#T%x#T#ZMX#Z~%x]M^Y'PSOz%xz{&^{!P%x!P!Q'S!Q![M|![!c%x!c!iM|!i#T%x#T#ZM|#Z~%x]NRY'PSOz%xz{&^{!P%x!P!Q'S!Q![Bd![!c%x!c!iBd!i#T%x#T#ZBd#Z~%x]NvY'PSOz%xz{&^{!P%x!P!Q'S!Q![! f![!c%x!c!i! f!i#T%x#T#Z! f#Z~%x]! k['PSOz%xz{&^{!P%x!P!Q'S!Q![! f![!c%x!c!i! f!i#T%x#T#Z! f#Z#q%x#q#rBd#r~%x]!!fY'PSOz%xz{&^{!P%x!P!Q'S!Q![!#U![!c%x!c!i!#U!i#T%x#T#Z!#U#Z~%x]!#ZY'PSOz%xz{&^{!P%x!P!Q'S!Q![Bd![!c%x!c!iBd!i#T%x#T#ZBd#Z~%x_!$SZ}X'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_!%OZ!PX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_!%x](QX'`QOY)xYZ+hZr)xrs&psz)xz{)Q{!P)x!P!Q0w!Q!_)x!_!`!&q!`#O)x#O#P&p#P~)x_!&xZ#QX'`QOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_!'t](PX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`:n!`#O$h#O#P%x#P~$h_!(vZ!eX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_!)r^'hX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`:n!`!a!*n!a#O$h#O#P%x#P~$h_!*wZ#SX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_!+s[(OX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!O$h!O!P!,i!P!Q*p!Q#O$h#O#P%x#P~$h_!,r^!lX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!O$h!O!P!-n!P!Q*p!Q!_$h!_!`!.j!`#O$h#O#P%x#P~$h_!-wZ!tX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$hV!.sZ'rP'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_!/m]'`Q'xXOY)xYZ+hZr)xrs&psz)xz{!0f{!P)x!P!Q!0|!Q!_)x!_!`!&q!`#O)x#O#P&p#P~)x_!0mT'O]'`QOY+|YZ,bZr+|s#O+|#P~+|_!1TZ'`QUXOY!1vYZ0cZr!1vrs!4xsz!1vz{!7T{!P!1v!P!Q!0|!Q#O!1v#O#P!4x#P~!1v_!1}Z'`QUXOY!2pYZ/RZr!2prs!3nsz!2pz{!6Z{!P!2p!P!Q!0|!Q#O!2p#O#P!3n#P~!2p_!2{Z'`QUX'QS'PSOY!2pYZ/RZr!2prs!3nsz!2pz{!6Z{!P!2p!P!Q!0|!Q#O!2p#O#P!3n#P~!2p]!3wVUX'QS'PSOY!3nYZ(UZz!3nz{!4^{!P!3n!P!Q!5d!Q~!3n]!4cVUXOY!4xYZ'rZz!4xz{!4^{!P!4x!P!Q!6O!Q~!4x]!4}VUXOY!3nYZ(UZz!3nz{!4^{!P!3n!P!Q!5d!Q~!3n]!5iVUXOY!4xYZ'rZz!4xz{!6O{!P!4x!P!Q!5d!Q~!4xX!6TQUXOY!6OZ~!6O_!6bZ'`QUXOY!1vYZ0cZr!1vrs!4xsz!1vz{!6Z{!P!1v!P!Q!7T!Q#O!1v#O#P!4x#P~!1vZ!7[V'`QUXOY!7TYZ,bZr!7Trs!6Os#O!7T#O#P!6O#P~!7T_!7zhuX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q![!9f![#O$h#O#P%x#P#R$h#R#S!9f#S#U$h#U#V!Dc#V#]$h#]#^!:w#^#c$h#c#d!F}#d#i$h#i#j!:w#j#l$h#l#m!Ic#m~$h_!9obuX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q![!9f![#O$h#O#P%x#P#R$h#R#S!9f#S#]$h#]#^!:w#^#i$h#i#j!:w#j~$h_!;Oe'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!R$h!R!S!<a!S!T$h!T!U!?c!U!W$h!W!X!@c!X!Y$h!Y!Z!>g!Z#O$h#O#P%x#P#g$h#g#h!Ac#h~$h_!<h_'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!S$h!S!T!=g!T!W$h!W!X!>g!X#O$h#O#P%x#P~$h_!=n]'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!Y$h!Y!Z!>g!Z#O$h#O#P%x#P~$h_!>pZuX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_!?j]'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!S$h!S!T!>g!T#O$h#O#P%x#P~$h_!@j]'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!U$h!U!V!>g!V#O$h#O#P%x#P~$h_!Aj]'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P#]$h#]#^!Bc#^~$h_!Bj]'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P#n$h#n#o!Cc#o~$h_!Cj]'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P#X$h#X#Y!>g#Y~$h_!Dj_'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!R!Ei!R!S!Ei!S#O$h#O#P%x#P#R$h#R#S!Ei#S~$h_!ErcuX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!R!Ei!R!S!Ei!S#O$h#O#P%x#P#R$h#R#S!Ei#S#]$h#]#^!:w#^#i$h#i#j!:w#j~$h_!GU^'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!Y!HQ!Y#O$h#O#P%x#P#R$h#R#S!HQ#S~$h_!HZbuX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!Y!HQ!Y#O$h#O#P%x#P#R$h#R#S!HQ#S#]$h#]#^!:w#^#i$h#i#j!:w#j~$h_!Ijb'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q![!Jr![!c$h!c!i!Jr!i#O$h#O#P%x#P#R$h#R#S!Jr#S#T$h#T#Z!Jr#Z~$h_!J{fuX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q![!Jr![!c$h!c!i!Jr!i#O$h#O#P%x#P#R$h#R#S!Jr#S#T$h#T#Z!Jr#Z#]$h#]#^!:w#^#i$h#i#j!:w#j~$h_!Lj]!SX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q![$h![!]!Mc!]#O$h#O#P%x#P~$h_!MlZdX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_!NhZyX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_# d^#RX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!^$h!^!_#!`!_!`3u!`#O$h#O#P%x#P~$h_#!i]'yX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`:n!`#O$h#O#P%x#P~$h_##k^oX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`3u!`!a#$g!a#O$h#O#P%x#P~$h_#$pZ#TX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_#%l^#RX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`3u!`!a#&h!a#O$h#O#P%x#P~$h_#&q]'zX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`:n!`#O$h#O#P%x#P~$h_#'sZ(RX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$hV#(oZ'qP'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_#)mh'`Q'PS!{W'UPOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q![#)b![!c$h!c!}#)b!}#O$h#O#P%x#P#R$h#R#S#)b#S#T$h#T#o#)b#o${$h${$|#)b$|4w$h4w5b#)b5b5i$h5i6S#)b6S~$h_#+bZ[X'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$hU#,YX'PSOz#,uz{#-]{!P#,u!P!Q#-q!Q#i#,u#i#j#.S#j#l#,u#l#m#2z#m~#,uU#,|TrQ'PSOz%xz{&^{!P%x!P!Q'S!Q~%xU#-bTrQOz&pz{&^{!P&p!P!Q({!Q~&pU#-vSrQOz&p{!P&p!P!Q'c!Q~&pU#.X['PSOz%xz{&^{!P%x!P!Q'S!Q![#.}![!c%x!c!i#.}!i#T%x#T#Z#.}#Z#o%x#o#p#1[#p~%xU#/SY'PSOz%xz{&^{!P%x!P!Q'S!Q![#/r![!c%x!c!i#/r!i#T%x#T#Z#/r#Z~%xU#/wY'PSOz%xz{&^{!P%x!P!Q'S!Q![#0g![!c%x!c!i#0g!i#T%x#T#Z#0g#Z~%xU#0lY'PSOz%xz{&^{!P%x!P!Q'S!Q![#,u![!c%x!c!i#,u!i#T%x#T#Z#,u#Z~%xU#1aY'PSOz%xz{&^{!P%x!P!Q'S!Q![#2P![!c%x!c!i#2P!i#T%x#T#Z#2P#Z~%xU#2U['PSOz%xz{&^{!P%x!P!Q'S!Q![#2P![!c%x!c!i#2P!i#T%x#T#Z#2P#Z#q%x#q#r#,u#r~%xU#3PY'PSOz%xz{&^{!P%x!P!Q'S!Q![#3o![!c%x!c!i#3o!i#T%x#T#Z#3o#Z~%xU#3tY'PSOz%xz{&^{!P%x!P!Q'S!Q![#,u![!c%x!c!i#,u!i#T%x#T#Z#,u#Z~%x_#4mZXX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_#5i]'{X'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`:n!`#O$h#O#P%x#P~$h_#6mj'`Q'PS!{W'UPOY$hYZ%bZr$hrs#8_sw$hwx#8uxz$hz{)Q{!P$h!P!Q*p!Q![#)b![!c$h!c!}#)b!}#O$h#O#P%x#P#R$h#R#S#)b#S#T$h#T#o#)b#o${$h${$|#)b$|4w$h4w5b#)b5b5i$h5i6S#)b6S~$h]#8fT'PS'_XOz%xz{&^{!P%x!P!Q'S!Q~%x_#8|]'`Q'PSOY?dYZA`Zr?drsBdsw?dwx@dxz?dz{CO{!P?d!P!QDv!Q#O?d#O#PId#P~?d_#:Qi'`Q'PS!{W'UPOY$hYZ%bZr$hrs%xst#;otz$hz{)Q{!P$h!P!Q*p!Q![#)b![!c$h!c!}#)b!}#O$h#O#P%x#P#R$h#R#S#)b#S#T$h#T#o#)b#o${$h${$|#)b$|4w$h4w5b#)b5b5i$h5i6S#)b6S~$hV#;vg'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!c$h!c!}#=_!}#O$h#O#P%x#P#R$h#R#S#=_#S#T$h#T#o#=_#o${$h${$|#=_$|4w$h4w5b#=_5b5i$h5i6S#=_6S~$hV#=hh'`Q'PS'UPOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q![#=_![!c$h!c!}#=_!}#O$h#O#P%x#P#R$h#R#S#=_#S#T$h#T#o#=_#o${$h${$|#=_$|4w$h4w5b#=_5b5i$h5i6S#=_6S~$h_#?]ZwX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_#@X_'sX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q!_$h!_!`:n!`#O$h#O#P%x#P#p$h#p#q#AW#q~$h_#AaZ'|X'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h_#B]ZvX'`Q'PSOY$hYZ%bZr$hrs%xsz$hz{)Q{!P$h!P!Q*p!Q#O$h#O#P%x#P~$h",
  tokenizers: [closureParam, tpDelim, literalTokens, 0, 1, 2, 3],
  topRules: { "SourceFile": [0, 8] },
  specialized: [{ term: 282, get: (value) => spec_identifier[value] || -1 }],
  tokenPrec: 15890
});

// node_modules/@codemirror/lang-rust/dist/index.js
import { LezerLanguage, indentNodeProp, continuedIndent, foldNodeProp, foldInside, LanguageSupport } from "@codemirror/language";
import { styleTags, tags } from "@codemirror/highlight";
var rustLanguage = LezerLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        IfExpression: continuedIndent({ except: /^\s*({|else\b)/ }),
        "String BlockComment": () => -1,
        "Statement MatchArm": continuedIndent()
      }),
      foldNodeProp.add((type) => {
        if (/(Block|edTokens|List)$/.test(type.name))
          return foldInside;
        if (type.name == "BlockComment")
          return (tree) => ({ from: tree.from + 2, to: tree.to - 2 });
        return void 0;
      }),
      styleTags({
        "const macro_rules mod struct union enum type fn impl trait let use crate static": tags.definitionKeyword,
        "pub unsafe async mut extern default move": tags.modifier,
        "for if else loop while match continue break return await": tags.controlKeyword,
        "as in ref": tags.operatorKeyword,
        "where _ crate super dyn": tags.keyword,
        "self": tags.self,
        String: tags.string,
        RawString: tags.special(tags.string),
        Boolean: tags.bool,
        Identifier: tags.variableName,
        "CallExpression/Identifier": tags.function(tags.variableName),
        BoundIdentifier: tags.definition(tags.variableName),
        LoopLabel: tags.labelName,
        FieldIdentifier: tags.propertyName,
        "CallExpression/FieldExpression/FieldIdentifier": tags.function(tags.propertyName),
        Lifetime: tags.special(tags.variableName),
        ScopeIdentifier: tags.namespace,
        TypeIdentifier: tags.typeName,
        "MacroInvocation/Identifier MacroInvocation/ScopedIdentifier/Identifier": tags.macroName,
        "MacroInvocation/TypeIdentifier MacroInvocation/ScopedIdentifier/TypeIdentifier": tags.macroName,
        '"!"': tags.macroName,
        UpdateOp: tags.updateOperator,
        LineComment: tags.lineComment,
        BlockComment: tags.blockComment,
        Integer: tags.integer,
        Float: tags.float,
        ArithOp: tags.arithmeticOperator,
        LogicOp: tags.logicOperator,
        BitOp: tags.bitwiseOperator,
        CompareOp: tags.compareOperator,
        "=": tags.definitionOperator,
        ".. ... => ->": tags.punctuation,
        "( )": tags.paren,
        "[ ]": tags.squareBracket,
        "{ }": tags.brace,
        ".": tags.derefOperator,
        "&": tags.operator,
        ", ; ::": tags.separator
      })
    ]
  }),
  languageData: {
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    indentOnInput: /^\s*(?:\{|\})$/
  }
});
function rust() {
  return new LanguageSupport(rustLanguage);
}

// src/slicer.tsx
var import_axios = __toModule(require_axios2());
import React, { useState } from "react";
import {
  Listing,
  add_highlight,
  clear_highlights,
  linecol_to_pos,
  pos_to_linecol
} from "nota/dist/code";
import { EditorView } from "@codemirror/view";
var SliceListing = ({
  code,
  prelude
}) => {
  let [editor, set_editor] = useState(null);
  let get_slice = async (range) => {
    editor.dispatch({ effects: clear_highlights.of(null) });
    let program = [prelude || ""].concat(editor.state.doc.toJSON()).join("\n");
    let start = pos_to_linecol(editor, range[0]);
    let end = pos_to_linecol(editor, range[1]);
    start.line += 1;
    end.line += 1;
    if (start.line != end.line) {
      throw "Start line different from end line";
    }
    let request = { program, line: start.line, start: start.col, end: end.col };
    let response = await import_axios.default.post("http://mindover.computer:8888", request);
    if (response.data.error) {
      console.error(response.data.error);
      return;
    }
    let ranges = response.data.ranges;
    editor.dispatch({
      effects: ranges.filter((range2) => range2.filename.includes("main.rs")).filter((range2) => !(range2.start_line == request.line && range2.start_col == request.start || range2.start_line == 1)).map((range2) => {
        let from = linecol_to_pos(editor, {
          line: range2.start_line - 1,
          col: range2.start_col
        });
        let to = linecol_to_pos(editor, {
          line: range2.end_line - 1,
          col: range2.end_col
        });
        return add_highlight.of({ from, to, color: "peach" });
      })
    });
    editor.dispatch({
      effects: [
        add_highlight.of({
          from: range[0],
          to: range[1],
          color: "forest-green"
        })
      ]
    });
  };
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(Listing, {
    editable: true,
    code,
    extensions: [
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          editor.dispatch({ effects: clear_highlights.of(null) });
        }
      })
    ],
    onLoad: (e) => {
      editor = e;
      set_editor(e);
    },
    delimiters: {
      delimiters: [["@", "@"]],
      onParse: ([range]) => {
        get_slice(range);
      }
    }
  }), /* @__PURE__ */ React.createElement("button", {
    onClick: () => {
      let selection = editor.state.selection;
      let range = selection.main;
      if (!range.empty) {
        get_slice([range.from, range.to]);
      }
    }
  }, "Slice"));
};

// src/diagram.tsx
var import_lodash = __toModule(require_lodash());
import React2, { useRef, useState as useState2, useCallback } from "react";
import { $, $$ } from "nota";
import { zipExn, useSynchronizer } from "nota/dist/utils";
import { Togglebox } from "nota/dist/togglebox";
import { IRToggle, Premise, PremiseRow } from "nota/dist/math";
var r = String.raw;
var get_relative_midpoint = (container, el, top) => {
  let cr = container.getBoundingClientRect();
  let er = el.getBoundingClientRect();
  let x = er.x - cr.x;
  let y = er.y - cr.y;
  let mx = x + er.width / 2;
  let my = top ? y : y + er.height;
  return { x: mx, y: my };
};
var SyntaxDiagram = () => {
  let container_ref = useRef(null);
  let [overlay, set_overlay] = useState2(null);
  let add_sync_point = useSynchronizer(useCallback(() => on_all_load(), []));
  let label_texts = [
    r`Variable $\vr$`,
    r`Sized Type $\tys$`,
    r`Expression $\expr$`,
    r`Place $\plc$`,
    r`Place Expr $\pexp$`,
    r`Ownership Qual. $\ownq$`,
    r`Provenance $\prov$`
  ];
  let labels = label_texts.map((text, i) => {
    let ref = useRef(null);
    let pos = i < 4 ? "top" : "bottom";
    let label = /* @__PURE__ */ React2.createElement("span", {
      ref,
      key: i,
      className: "diagram-label"
    }, /* @__PURE__ */ React2.createElement($, {
      onLoad: add_sync_point()
    }, r`\text{${text}}`));
    return { label, ref, pos };
  });
  let on_all_load = () => {
    let container = container_ref.current;
    let elems = container.querySelectorAll("[data-index]");
    let elems_arr = import_lodash.default.sortBy(Array.from(elems), (elem) => {
      let index = parseInt(elem.dataset.index);
      return index;
    });
    let arrows = zipExn(elems_arr, labels).map(([dst, label], i) => {
      let src = label.ref.current;
      let spt = get_relative_midpoint(container, src, label.pos == "bottom");
      let dpt = get_relative_midpoint(container, dst, label.pos == "top");
      let path = `M${spt.x},${spt.y} L${dpt.x},${dpt.y}`;
      return /* @__PURE__ */ React2.createElement("path", {
        key: i,
        d: path,
        style: { stroke: "#ccc", strokeWidth: "1.25px" }
      });
    });
    set_overlay(/* @__PURE__ */ React2.createElement("svg", {
      width: "700",
      height: "300",
      style: { position: "absolute", left: 0, top: 0 }
    }, /* @__PURE__ */ React2.createElement("defs", null, /* @__PURE__ */ React2.createElement("marker", {
      id: "arrow",
      markerWidth: "13",
      markerHeight: "13",
      orient: "auto",
      refX: "2",
      refY: "6"
    }, /* @__PURE__ */ React2.createElement("path", {
      d: "M2,2 L2,11 L10,6 L2,2",
      style: { fill: "#ccc" }
    }))), arrows));
  };
  return /* @__PURE__ */ React2.createElement("div", {
    id: "syntax-diagram",
    ref: container_ref,
    style: { textAlign: "center", position: "relative" }
  }, /* @__PURE__ */ React2.createElement("style", null, `
    .diagram-label { padding: 2px 4px; margin: 5px 10px; }
    .diagram-hl {
      border: 1px solid #ccc;
      border-radius: 2px;
    }
    .gutter.top {
      margin-bottom: 80px;
    }
    .gutter.bottom {
      margin-top: 30px;
    }
    
    `), overlay, /* @__PURE__ */ React2.createElement("div", {
    className: "gutter top"
  }, labels.filter(({ pos }) => pos == "top").map(({ label }) => label)), /* @__PURE__ */ React2.createElement($$, {
    onLoad: add_sync_point(),
    style: { height: "7rem", marginTop: "3rem" }
  }, r`
    \newcommand{\lbl}[2]{\htmlClass{diagram-hl}{\htmlData{index=#1}{#2}}}
    \begin{aligned}
    &\exprlet
      {\lbl{0}{a}}{\lbl{1}{\tystup{\uty, \uty}}}
      {\lbl{2}{\exprtup{\exprconst{\constnum{0}}, \exprconst{\constnum{1}}}}}{
    \\ \exprprov{\r_1, \r_2}{
      \\ ~~ \exprlet
        {b}{\tysref{\r_2}{\lbl{5}{\uniq}}{\uty}}
        {\exprref{\lbl{6}{\r_1}}{\uniq}{\lbl{3}{a.0}}}{
      \\ ~~ \exprpexpasgn{\lbl{4}{\pexpderef{b}}}{a.1} \\
      }}
    }
    \end{aligned}`), /* @__PURE__ */ React2.createElement("div", {
    className: "gutter bottom"
  }, labels.filter(({ pos }) => pos == "bottom").map(({ label }) => label)));
};
var $T = (tex) => (props) => /* @__PURE__ */ React2.createElement($, {
  ...props
}, r`\text{${tex}}`);
var AssignStaticRule = () => /* @__PURE__ */ React2.createElement(IRToggle, {
  Top: ({ reg }) => /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement(PremiseRow, null, /* @__PURE__ */ React2.createElement(Premise, null, /* @__PURE__ */ React2.createElement(Togglebox, {
    registerToggle: reg,
    Outside: $T(r`$\expr$ has sized type $\tys$, making $\stackenv_1$`),
    Inside: $T(r`$\tc{\fenv}{\tyenv}{\stackenv}{\expr}{\tys}{\stackenv'}$`)
  })), /* @__PURE__ */ React2.createElement(Premise, null, /* @__PURE__ */ React2.createElement(Togglebox, {
    registerToggle: reg,
    Outside: $T(r`$\plc$ has maybe-dead type $\tysx$ in $\stackenv_1$`),
    Inside: $T(r`$\stackenv_1(\plc) = \tysx$`)
  }))), /* @__PURE__ */ React2.createElement(PremiseRow, null, /* @__PURE__ */ React2.createElement(Premise, null, "(", /* @__PURE__ */ React2.createElement(Togglebox, {
    registerToggle: reg,
    Outside: $T(r`$\plc$ is dead`),
    Inside: $T(r`$\tysx = \tyd$`)
  }), /* @__PURE__ */ React2.createElement($, {
    style: { margin: "0 0.5rem" }
  }, r`\vee`), /* @__PURE__ */ React2.createElement(Togglebox, {
    registerToggle: reg,
    Outside: $T(r`$\plc$ is $\uniq$-safe`),
    Inside: $T(r`$\ownsafe{\tyenv}{\stackenv_1}{\uniq}{\plc}{\{\loanform{\uniq}{\plc}\}}$`)
  }), ")"), /* @__PURE__ */ React2.createElement(Premise, null, /* @__PURE__ */ React2.createElement(Togglebox, {
    registerToggle: reg,
    Outside: $T(r`$\tys$ is a subtype of $\tysx$, making $\stackenv'$`),
    Inside: $T(r`$\subtype{\tyenv}{\stackenv_1}{\tys}{\tysx}{\stackenv'}$`)
  })))),
  Bot: ({ reg }) => /* @__PURE__ */ React2.createElement(Togglebox, {
    registerToggle: reg,
    Outside: $T(r`$\exprplcasgn{\plc}{\expr}$ has type $\tysbase{\tybunit}$ and adds $\plc : \tys$ to $\stackenv'$`),
    Inside: $T(r`
        $\tc{\fenv}{\tyenv}{\stackenv}
          {\exprplcasgn{\plc}{\expr}}
          {\tysbase{\tybunit}}
          {\stackenv'[\plc \mapsto \tys] \triangleright \plc}$
        `)
  })
});
var AssignDynamicRule = () => /* @__PURE__ */ React2.createElement(IRToggle, {
  Top: ({ reg }) => /* @__PURE__ */ React2.createElement(Togglebox, {
    registerToggle: reg,
    Outside: $T(r`$\pexp$ points to $\plc$ in $\stack$ with root $\vr$ and context $\valuectx$`),
    Inside: $T(r`$\pointsto{\stack}{\pexp}{\pctx{\plc}{\vr}}{\valuectx}$`)
  }),
  Bot: ({ reg }) => /* @__PURE__ */ React2.createElement(Togglebox, {
    registerToggle: reg,
    Outside: $T(r`$\exprpexpasgn{\pexp}{v}$ sets $\plc$ to $v$ in $\stack$ by setting $x$ to $\valueplug{\valuectx}{v}$`),
    Inside: $T(r`$\stepsto{\fenv}{\stack}{\exprpexpasgn{\pexp}{v}}{\stack[\vr \mapsto \valueplug{\valuectx}{v}]}{\exprconst{\constunit}}$`)
  })
});

// src/language.tsx
import { Language } from "nota/dist/language";
var r2 = String.raw;
var Oxide = new Language([
  ["Variable", "vr", "x", []],
  ["Function", "fname", "f", []],
  ["Number", "num", "n", []],
  ["Path", "path", "q", [
    [r2`empty`, 0, r2`\varepsilon`, []],
    [r2`elem`, 2, r2`{#1}.{#2}`, [r2`\num`, r2`\path`]]
  ]],
  ["Place", "plc", r2`\pi`, [
    [r2`form`, 2, r2`{#1}.{#2}`, [r2`\vr`, r2`\path`]]
  ]],
  ["Place Expression", "pexp", `p`, [
    [`var`, 1, r2`#1`, [r2`\vr`]],
    [`elem`, 2, r2`{#1}.{#2}`, [r2`\pexp`, r2`\num`]],
    [`deref`, 1, r2`\ast {#1}`, [r2`\pexp`]]
  ]],
  ["Constant", "const", "c", [
    [`unit`, 0, "()", []],
    [`num`, 1, "#1", [r2`\num`]],
    [`true`, 0, r2`\msf{true}`, []],
    [`false`, 0, r2`\msf{false}`, []]
  ]],
  ["Concrete Provenance", "concrprov", "r", []],
  ["Abstract Provenance", "abstrprov", r2`\varrho`, []],
  ["Provenance", "prov", r2`\rho`, [
    ["concr", 1, "#1", [r2`\concrprov`]],
    ["abstr", 1, "#1", [r2`\abstrprov`]]
  ]],
  ["Ownership Qualifier", "ownq", r2`\omega`, [
    ["shrd", 0, r2`\msf{shrd}`, []],
    ["uniq", 0, r2`\msf{uniq}`, []]
  ]],
  ["Base Type", "tyb", r2`\tau^\textsc{B}`, [
    ["unit", 0, r2`\msf{unit}`, []],
    ["num", 0, r2`\msf{u32}`, []],
    ["bool", 0, r2`\msf{bool}`, []]
  ]],
  ["Sized Type", "tys", r2`\tau^\textsc{SI}`, [
    ["base", 1, "{#1}", [r2`\tyb`]],
    ["ref", 3, r2`\&{#1}~{#2}~{#3}`, [r2`\prov`, r2`\ownq`, r2`\tau^\textsc{XI}`]],
    ["tup", 1, r2`({#1})`, [r2`\tys{}_1, \ldots, \tys{}_n`]]
  ]],
  ["Expression", "expr", "e", [
    ["const", 1, "{#1}", [r2`\const`]],
    ["pexp", 1, "{#1}", [r2`\pexp`]],
    ["ref", 3, r2`\&{#1}~{#2}~{#3}`, [r2`\concrprov`, r2`\ownq`, r2`\pexp`]],
    [
      "ite",
      3,
      r2`\msf{if}~{#1}~\{\,{#2}\,\}~\msf{else}~\{\,{#3}\,\}`,
      [r2`\expr_1`, r2`\expr_2`, r2`\expr_3`]
    ],
    [
      "let",
      4,
      r2`\msf{let}~{#1} : {#2} = {#3}; ~ {#4}`,
      [r2`\expr_1`, r2`\tys`, r2`\expr_2`, r2`\expr_3`]
    ],
    ["plcasgn", 2, r2`{#1} \mathrel{:=} {#2}`, [r2`\plc`, r2`\expr`]],
    ["pexpasgn", 2, r2`{#1} \mathrel{:=} {#2}`, [r2`\pexp`, r2`\expr`]],
    ["seq", 2, r2`{#1};~{#2}`, [r2`\expr_1`, r2`\expr_2`]],
    [
      "call",
      5,
      r2`{#1}\left\langle{#2}, {#3}, {#4}\right\rangle\left({#5}\right)`,
      [r2`\fname`, r2`\overline{\Phi}`, r2`\overline{\rho}`, r2`\overline{\tau}`, r2`\plc`]
    ],
    ["tup", 1, "({#1})", [r2`\expr_1, \ldots, \expr_n`]],
    ["prov", 2, r2`\msf{letprov}\langle{#1}\rangle\,\{{#2}\}`, [r2`\concrprov`, r2`\expr`]]
  ]],
  ["Global Entries", "fdef", r2`\varepsilon`, [
    [
      "form",
      9,
      r2`\msf{fn}~{#1}\left\langle {#2}, {#3}, {#4}, \right\rangle\left({#5} : {#6}\right) \rightarrow {#7} ~ \msf{where} ~ {#8} ~ \{\,{#9}\,\}`,
      [
        r2`\fname`,
        r2`\overline{\psi}`,
        r2`\overline{\abstrprov}`,
        r2`\overline{\alpha}`,
        r2`\vr`,
        r2`\tys_a`,
        r2`\tys_r`,
        r2`\overline{\abstrprov_1 : \abstrprov_2}`,
        r2`\expr`
      ]
    ]
  ]],
  ["Global Environment", "fenv", r2`\Sigma`, [
    ["empty", 0, r2`\bullet`, []],
    ["with", 2, r2`{#1}, {#2}`, [r2`\fenv`, r2`\fdef`]]
  ]]
]);
var OxideExtra = new Language([
  ["Dead Types", "tyd", r2`\tau^\textsc{SD}`, [
    ["s", 1, r2`{#1}^\dagger`, [r2`\tys`]],
    ["tup", 1, r2`({#1})`, [r2`\tyd_1, \ldots, \tyd_n`]]
  ]],
  ["Maybe Unsized Type", "tyx", r2`\tau^\textsc{XI}`, [
    ["s", 1, "{#1}", [r2`\tys`]],
    ["a", 1, "[{#1}]", [r2`\tys`]]
  ]],
  ["Maybe Dead Types", "tysx", r2`\tau^\textsc{SX}`, [
    ["s", 1, "{#1}", [r2`\tys`]],
    ["d", 1, "{#1}", [r2`\tyd`]],
    ["tup", 1, "({#1})", [r2`\tysx_1, \ldots, \tysx_n`]]
  ]],
  ["Type", "ty", r2`\tau`, [
    ["tyx", 1, "{#1}", [r2`\tyx`]],
    ["tysx", 1, "{#1}", [r2`\tysx`]]
  ]],
  ["Loan", "loan", r2`\ell`, [
    [`form`, 2, r2`\,^{#1}{#2}`, [r2`\ownq`, r2`\pexp`]]
  ]],
  ["Frame Var", "frmvar", r2`\varphi`, []],
  ["Frame Typing", "ft", r2`\mathcal{F}`, [
    ["empty", 0, r2`\bullet`, []],
    ["wty", 3, "{#1}, {#2} : {#3}", [r2`\ft`, r2`\vr`, r2`\tyx`]],
    [
      "wlf",
      3,
      r2`{#1}, {#2} \mapsto {#3}`,
      [r2`\ft`, r2`\concrprov`, r2`\setof{\loan}`]
    ]
  ]],
  ["Stack Typing", "stackenv", r2`\Gamma`, [
    ["empty", 0, r2`\bullet`, []],
    ["wfr", 2, r2`{#1} \mathrel{\natural} {#2}`, [r2`\stackenv`, r2`\ft`]]
  ]],
  ["Kind", "kind", r2`\kappa`, [
    ["base", 0, r2`\bigstar`, []],
    ["prv", 0, r2`\msf{PRV}`, []],
    ["frm", 0, r2`\msf{FRM}`, []]
  ]],
  ["Type Var", "tyvar", r2`\alpha`, []],
  ["Type Environment", "tyenv", r2`\Delta`, [
    ["empty", 0, r2`\bullet`, []],
    ["wtvar", 2, r2`{#1}, {#2} : \kindbase`, [r2`\tyenv`, r2`\tyvar`]],
    ["wprv", 2, r2`{#1}, {#2} : \kindprv`, [r2`\tyenv`, r2`\abstrprov`]],
    ["wfrm", 2, r2`{#1}, {#2} : \kindfrm`, [r2`\tyenv`, r2`\frmvar`]],
    ["wconstr", 3, r2`{#1}, {#2} \mathrel{:>} {#3}`, [r2`\tyenv`, r2`\abstrprov`, r2`\abstrprov'`]]
  ]]
]);

// src/example.bib
var example_default = `@inproceedings{horwitz1988interprocedural,
  title={Interprocedural slicing using dependence graphs},
  author={Horwitz, Susan and Reps, Thomas and Binkley, David},
  booktitle={Proceedings of the ACM SIGPLAN 1988 conference on Programming Language design and Implementation},
  pages={35--46},
  year={1988}
}

@article{ferrante1987program,
  title={The program dependence graph and its use in optimization},
  author={Ferrante, Jeanne and Ottenstein, Karl J and Warren, Joe D},
  journal={ACM Transactions on Programming Languages and Systems (TOPLAS)},
  volume={9},
  number={3},
  pages={319--349},
  year={1987},
  publisher={ACM New York, NY, USA}
}

@article{cooper2001simple,
  title={A simple, fast dominance algorithm},
  author={Cooper, Keith D and Harvey, Timothy J and Kennedy, Ken},
  journal={Software Practice \\& Experience},
  volume={4},
  number={1-10},
  pages={1--8},
  year={2001}
}

@article{weiser1984program,
  title={Program slicing},
  author={Weiser, Mark},
  journal={IEEE Transactions on software engineering},
  number={4},
  pages={352--357},
  year={1984},
  publisher={IEEE}
}

@article{weiser1982programmers,
  title={Programmers use slices when debugging},
  author={Weiser, Mark},
  journal={Communications of the ACM},
  volume={25},
  number={7},
  pages={446--452},
  year={1982},
  publisher={ACM New York, NY, USA}
}

@article{xu2005brief,
  title={A brief survey of program slicing},
  author={Xu, Baowen and Qian, Ju and Zhang, Xiaofang and Wu, Zhongqiang and Chen, Lin},
  journal={ACM SIGSOFT Software Engineering Notes},
  volume={30},
  number={2},
  pages={1--36},
  year={2005},
  publisher={ACM New York, NY, USA}
}

@article{silva2012vocabulary,
  title={A vocabulary of program slicing-based techniques},
  author={Silva, Josep},
  journal={ACM computing surveys (CSUR)},
  volume={44},
  number={3},
  pages={1--41},
  year={2012},
  publisher={ACM New York, NY, USA}
}

@inproceedings{parnin2011automated,
  title={Are automated debugging techniques actually helping programmers?},
  author={Parnin, Chris and Orso, Alessandro},
  booktitle={Proceedings of the 2011 international symposium on software testing and analysis},
  pages={199--209},
  year={2011}
}

@inproceedings{cuoq2012frama,
  title={Frama-c},
  author={Cuoq, Pascal and Kirchner, Florent and Kosmatov, Nikolai and Prevosto, Virgile and Signoles, Julien and Yakobowski, Boris},
  booktitle={International conference on software engineering and formal methods},
  pages={233--247},
  year={2012},
  organization={Springer}
}

@inproceedings{balakrishnan2005codesurfer,
  title={Codesurfer/x86\u2014a platform for analyzing x86 executables},
  author={Balakrishnan, Gogul and Gruian, Radu and Reps, Thomas and Teitelbaum, Tim},
  booktitle={International Conference on Compiler Construction},
  pages={250--254},
  year={2005},
  organization={Springer}
}

@inproceedings{zhao2018parallel,
  title={Parallel sparse flow-sensitive points-to analysis},
  author={Zhao, Jisheng and Burke, Michael G and Sarkar, Vivek},
  booktitle={Proceedings of the 27th International Conference on Compiler Construction},
  pages={59--70},
  year={2018}
}

@inproceedings{might2010resolving,
  title={Resolving and exploiting the k-CFA paradox: illuminating functional vs. object-oriented program analysis},
  author={Might, Matthew and Smaragdakis, Yannis and Van Horn, David},
  booktitle={Proceedings of the 31st ACM SIGPLAN Conference on Programming Language Design and Implementation},
  pages={305--315},
  year={2010}
}

@inproceedings{clarke1998ownership,
  title={Ownership types for flexible alias protection},
  author={Clarke, David G and Potter, John M and Noble, James},
  booktitle={Proceedings of the 13th ACM SIGPLAN conference on Object-oriented programming, systems, languages, and applications},
  pages={48--64},
  year={1998}
}

@inproceedings{grossman2002region,
  title={Region-based memory management in Cyclone},
  author={Grossman, Dan and Morrisett, Greg and Jim, Trevor and Hicks, Michael and Wang, Yanling and Cheney, James},
  booktitle={Proceedings of the ACM SIGPLAN 2002 Conference on Programming language design and implementation},
  pages={282--293},
  year={2002}
}

@inproceedings{agrawal2001evaluating,
  title={Evaluating explicitly context-sensitive program slicing},
  author={Agrawal, Gagan and Guo, Liang},
  booktitle={Proceedings of the 2001 ACM SIGPLAN-SIGSOFT workshop on Program analysis for software tools and engineering},
  pages={6--12},
  year={2001}
}

@article{girard1987linear,
  title={Linear logic},
  author={Girard, Jean-Yves},
  journal={Theoretical computer science},
  volume={50},
  number={1},
  pages={1--101},
  year={1987},
  publisher={Elsevier}
}

@article{weiss2019oxide,
  title={Oxide: The essence of rust},
  author={Weiss, Aaron and Gierczak, Olek and Patterson, Daniel and Matsakis, Nicholas D and Ahmed, Amal},
  journal={arXiv preprint arXiv:1903.00982},
  year={2019}
}

@inproceedings{rountev1999data,
  title={Data-flow analysis of program fragments},
  author={Rountev, Atanas and Ryder, Barbara G and Landi, William},
  booktitle={Software Engineering\u2014ESEC/FSE\u201999},
  pages={235--252},
  year={1999},
  organization={Springer}
}

@inproceedings{cousot2002modular,
  title={Modular static program analysis},
  author={Cousot, Patrick and Cousot, Radhia},
  booktitle={International Conference on Compiler Construction},
  pages={159--179},
  year={2002},
  organization={Springer}
}

@inproceedings{gulwani2007computing,
  title={Computing procedure summaries for interprocedural analysis},
  author={Gulwani, Sumit and Tiwari, Ashish},
  booktitle={European Symposium on Programming},
  pages={253--267},
  year={2007},
  organization={Springer}
}

@inproceedings{yorsh2008generating,
  title={Generating precise and concise procedure summaries},
  author={Yorsh, Greta and Yahav, Eran and Chandra, Satish},
  booktitle={Proceedings of the 35th annual ACM SIGPLAN-SIGACT symposium on Principles of programming languages},
  pages={221--234},
  year={2008}
}

@book{sharir1978two,
  title={Two approaches to interprocedural data flow analysis},
  author={Sharir, Micha and Pnueli, Amir and others},
  year={1978},
  publisher={New York University. Courant Institute of Mathematical Sciences}
}

@inproceedings{tang2015summary,
  title={Summary-based context-sensitive data-dependence analysis in presence of callbacks},
  author={Tang, Hao and Wang, Xiaoyin and Zhang, Lingming and Xie, Bing and Zhang, Lu and Mei, Hong},
  booktitle={Proceedings of the 42Nd Annual ACM SIGPLAN-SIGACT Symposium on Principles of Programming Languages},
  pages={83--95},
  year={2015}
}

@inproceedings{madhavan2012modular,
  title={Modular heap analysis for higher-order programs},
  author={Madhavan, Ravichandhran and Ramalingam, Ganesan and Vaswani, Kapil},
  booktitle={International Static Analysis Symposium},
  pages={370--387},
  year={2012},
  organization={Springer}
}
 
@inproceedings{wadler1989theorems,
  title={Theorems for free!},
  author={Wadler, Philip},
  booktitle={Proceedings of the fourth international conference on Functional programming languages and computer architecture},
  pages={347--359},
  year={1989}
}

@article{tofte1997region,
  title={Region-based memory management},
  author={Tofte, Mads and Talpin, Jean-Pierre},
  journal={Information and computation},
  volume={132},
  number={2},
  pages={109--176},
  year={1997},
  publisher={Elsevier}
}

@misc{nllrfc,
    author={Niko Matsakis},
    title={Non-lexical lifetimes},
    year={2017},
    url={https://rust-lang.github.io/rfcs/2094-nll.html}
}

@misc{polonius,
  author={Niko Matsakis},
  title={An alias-based formulation of the borrow checker},
  year={2018},
  url={http://smallcultfollowing.com/babysteps/blog/2018/04/27/an-alias-based-formulation-of-the-borrow-checker}
}

@article{jung2017rustbelt,
  title={RustBelt: Securing the foundations of the Rust programming language},
  author={Jung, Ralf and Jourdan, Jacques-Henri and Krebbers, Robbert and Dreyer, Derek},
  journal={Proceedings of the ACM on Programming Languages},
  volume={2},
  number={POPL},
  pages={1--34},
  year={2017},
  publisher={ACM New York, NY, USA}
}

@book{appel1997modern,
  title={Modern Compiler Implementation in ML},
  author={Appel, Andrew W},
  year={1997},
  publisher={Cambridge University Press}
}

@misc{mirguide,
    title={The MIR (Mid-level IR) - Guide to Rustc Development},
    year={2021},
    url={https://rustc-dev-guide.rust-lang.org/mir/index.html},
}

@inproceedings{cytron1989efficient,
  title={An efficient method of computing static single assignment form},
  author={Cytron, Ron and Ferrante, Jeanne and Rosen, Barry K and Wegman, Mark N and Zadeck, F Kenneth},
  booktitle={Proceedings of the 16th ACM SIGPLAN-SIGACT symposium on Principles of programming languages},
  pages={25--35},
  year={1989}
}

@misc{cloc,
    title={cloc: Count Lines of Code},
    author={Al Danial},
    year={2021},
    url={https://github.com/AlDanial/cloc}
}

@mastersthesis{llvmslicer,
 author={Marek Chalupa},
 title = {Slicing of LLVM bitcode},
 school = {Masaryk University},
 year = {2016},
} 

@inproceedings{jayaraman2005kaveri,
  title={Kaveri: Delivering the indus java program slicer to eclipse},
  author={Jayaraman, Ganeshan and Ranganath, Venkatesh Prasad and Hatcliff, John},
  booktitle={International Conference on Fundamental Approaches to Software Engineering},
  pages={269--272},
  year={2005},
  organization={Springer}
}

@inproceedings{abadi1999core,
  title={A core calculus of dependency},
  author={Abadi, Mart{\\'\\i}n and Banerjee, Anindya and Heintze, Nevin and Riecke, Jon G},
  booktitle={Proceedings of the 26th ACM SIGPLAN-SIGACT symposium on Principles of programming languages},
  pages={147--160},
  year={1999}
}

@phdthesis{andersen1994program,
  title={Program analysis and specialization for the C programming language},
  author={Andersen, Lars Ole},
  year={1994},
  school={Citeseer}
}

@inproceedings{steensgaard1996points,
  title={Points-to analysis in almost linear time},
  author={Steensgaard, Bjarne},
  booktitle={Proceedings of the 23rd ACM SIGPLAN-SIGACT symposium on Principles of programming languages},
  pages={32--41},
  year={1996}
}

@article{pottier2003information,
  title={Information flow inference for ML},
  author={Pottier, Fran{\\c{c}}ois and Simonet, Vincent},
  journal={ACM Transactions on Programming Languages and Systems (TOPLAS)},
  volume={25},
  number={1},
  pages={117--158},
  year={2003},
  publisher={ACM New York, NY, USA}
}

@inproceedings{campbell2018cognitive,
  title={Cognitive complexity: An overview and evaluation},
  author={Campbell, G Ann},
  booktitle={Proceedings of the 2018 international conference on technical debt},
  pages={57--58},
  year={2018}
}

@article{smaragdakis2015pointer,
  title={Pointer analysis},
  author={Smaragdakis, Yannis and Balatsouras, George},
  journal={Foundations and Trends in Programming Languages},
  volume={2},
  number={1},
  pages={1--69},
  year={2015},
  publisher={Now Publishers Inc. Hanover, MA, USA}
}

@article{astrauskas2019leveraging,
  title={Leveraging Rust types for modular specification and verification},
  author={Astrauskas, Vytautas and M{\\"u}ller, Peter and Poli, Federico and Summers, Alexander J},
  journal={Proceedings of the ACM on Programming Languages},
  volume={3},
  number={OOPSLA},
  pages={1--30},
  year={2019},
  publisher={ACM New York, NY, USA}
}

@article{jung2020stacked,
  title={Stacked borrows: an aliasing model for Rust},
  author={Jung, Ralf and Dang, Hoang-Hai and Kang, Jeehoon and Dreyer, Derek},
  journal={Proceedings of the ACM on Programming Languages},
  volume={4},
  number={POPL},
  pages={1--32},
  year={2020},
  publisher={ACM New York, NY, USA}
}

@article{astrauskas2020programmers,
  title={How do programmers use unsafe rust?},
  author={Astrauskas, Vytautas and Matheja, Christoph and Poli, Federico and M{\\"u}ller, Peter and Summers, Alexander J},
  journal={Proceedings of the ACM on Programming Languages},
  volume={4},
  number={OOPSLA},
  pages={1--27},
  year={2020},
  publisher={ACM New York, NY, USA}
}

@article{dillig2011precise,
  title={Precise and compact modular procedure summaries for heap manipulating programs},
  author={Dillig, Isil and Dillig, Thomas and Aiken, Alex and Sagiv, Mooly},
  journal={ACM SIGPLAN Notices},
  volume={46},
  number={6},
  pages={567--577},
  year={2011},
  publisher={ACM New York, NY, USA}
}`;

// src/paper.tsx
var r3 = String.raw;
var C = (props) => /* @__PURE__ */ React3.createElement("code", {
  ...props
});
var Paper = (props) => {
  let num_principles = 0;
  let Principle = ({ type, text }) => {
    num_principles += 1;
    let num = num_principles;
    let Label = () => /* @__PURE__ */ React3.createElement(React3.Fragment, null, `Principle ${num} (Slicing principle for ${type})`);
    let Text = () => /* @__PURE__ */ React3.createElement(React3.Fragment, null, text);
    return /* @__PURE__ */ React3.createElement(Definition, {
      name: `prin:${type}`,
      Label,
      Tooltip: Text,
      block: true
    }, /* @__PURE__ */ React3.createElement("p", {
      style: { margin: "1rem" }
    }, /* @__PURE__ */ React3.createElement("strong", null, "Principle ", num), " (Slicing principle for ", type, "). ", /* @__PURE__ */ React3.createElement("em", null, /* @__PURE__ */ React3.createElement(Text, null))));
  };
  return /* @__PURE__ */ React3.createElement(Document, {
    anonymous: true,
    bibtex: example_default,
    ...props
  }, /* @__PURE__ */ React3.createElement(ListingConfigure, {
    language: rust()
  }), /* @__PURE__ */ React3.createElement(Title, null, "Modular Program Slicing Through Ownership"), /* @__PURE__ */ React3.createElement(Authors, null, /* @__PURE__ */ React3.createElement(Author, null, /* @__PURE__ */ React3.createElement(Name, {
    value: "Will Crichton"
  }), /* @__PURE__ */ React3.createElement(Affiliation, null, /* @__PURE__ */ React3.createElement(Institution, {
    value: "Stanford University"
  })))), /* @__PURE__ */ React3.createElement(Abstract, null, "Program slicing, or identifying the subset of a program relevant to a value, relies on understanding the dataflow of a program. In languages with mutable pointers and functions like C or Java, tracking dataflow has historically required whole-program analysis, which can be be slow and challenging to integrate in practice. Advances in type systems have shown how to modularly track dataflow through the concept of ownership. We demonstrate that ownership can modularize program slicing by using types to compute a provably sound and reasonably precise approximation of mutation. We present an algorithm for slicing Oxide, a formalized ownership-based language, and prove the algorithm's soundness as a form of noninterference. Then we describe an implementation of the algorithm for the Rust programming language, and show empirically that modular slices are the same as whole-program slices in 95.4% of slices drawn from large Rust codebases."), /* @__PURE__ */ React3.createElement($$2, null, r3`
    \newcommand{\textsc}[1]{\text{\tiny #1}}
    \newcommand{\msf}[1]{\mathsf{#1}}
    \newcommand{\cmddef}[2]{\htmlData{def=#1}{#2}}
    ${newcommand("tc", 6, r3`{#1}; {#2}; {#3} \vdash {#4} : {#5} \Rightarrow {#6}`)}
    ${newcommand("ownsafe", 5, r3`{#1}; {#2} \vdash_{#3} {#4} \Rightarrow {#5}`)}
    ${newcommand("subtype", 5, r3`{#1}; {#2} \vdash {#3} \mathrel{\footnotesize \lesssim} {#4} \Rightarrow {#5}`)}
    ${newcommand("stepsto", 5, r3`{#1} \vdash ({#2};~{#3}) \rightarrow ({#4};~{#5})`)}
    \newcommand{\evalsto}[5]{{#1} \vdash ({#2};~{#3}) \overset{\footnotesize\ast}{\rightarrow} ({#4};~{#5})}
    ${newcommand("stack", 0, r3`\sigma`)}
    ${newcommand("pctx", 2, r3`{#1}^{\tiny\square}[{#2}]`)}
    ${newcommand("valuectx", 0, r3`\mathcal{V}`)}
    ${newcommand("valueplug", 2, r3`{#1}[{#2}]`)}
    ${newcommand("pointsto", 4, r3`{#1} \vdash {#2} \Downarrow {#3} \times {#4}`)}
    ${newcommand("notdisjoint", 2, r3`{#1} \sqcap {#2}`)}
    ${newcommand("disjoint", 2, r3`{#1} \mathrel{\#} {#2}`)}
    ${newcommand("refs", 2, r3`{#1}\text{-}\mathsf{refs}({#2})`)}
    ${newcommand("ownqleq", 2, r3`{#1} \lesssim {#2}`)}
    ${newcommand("stackeq", 3, r3`{#1} \mathrel{\overset{#3}{\sim}} {#2}`)}
    ${newcommand("allplaces", 2, r3`\msf{all}\text{-}\msf{places}({#1}, {#2})`)}
    \newcommand{\setof}[1]{\{\overline{#1}\}}
    \newcommand{\stepped}[1]{\vec{#1}}
    \newcommand{\link}[2]{\htmlClass{link type-#1}{#2}}
    \newcommand{\eqdef}{~\mathrel{\overset{\msf{def}}{=}}~}
    `), /* @__PURE__ */ React3.createElement(Oxide.Commands, null), /* @__PURE__ */ React3.createElement(OxideExtra.Commands, null), /* @__PURE__ */ React3.createElement($$2, null, r3`
    % Aliases to make it easier to port paper
    \newcommand{\uty}{\tybnum}
    \newcommand{\eref}[3]{\tysref{#2}{#1}{#3}}
    \newcommand{\uniq}{\ownquniq}
    \newcommand{\shrd}{\ownqshrd}
    \renewcommand{\r}{\concrprov}
    \newcommand{\loanset}{\setof{\loan}}
    \newcommand{\sty}{\msf{String}}
    \newcommand{\mut}{\msf{mut}}
    \newcommand{\any}{\msf{any}}
    \newcommand{\arrg}{\msf{arg}}
    \newcommand{\reff}{\msf{ref}}
    `), /* @__PURE__ */ React3.createElement(Section, {
    title: "Introduction",
    name: "sec:intro"
  }, /* @__PURE__ */ React3.createElement("p", null, "Program slicing is the task of identifying the subset of a program relevant to computing a value of interest. The concept of slicing was introduced 40 years ago when", " ", /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: "weiser1982programmers"
  }), " demonstrated that programmers mentally construct slices while debugging. Since then, hundreds of papers have been published on implementing automated program slice, as surveyed by", " ", /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: ["xu2005brief", "silva2012vocabulary"]
  }), '. Despite these efforts, a review of slicers found "slicing-based debugging techniques are rarely used in practice"', " ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "parnin2011automated"
  }), /* @__PURE__ */ React3.createElement(Footnote, null, "The only open-source, functioning slicers the authors could find are Frama-C", " ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "cuoq2012frama"
  }), " and dg ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "llvmslicer"
  }), ". Slicing tools for Java like Kaveri ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "jayaraman2005kaveri"
  }), " no longer work. The most industrial-strength slicing tool, CodeSurfer ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "balakrishnan2005codesurfer"
  }), " was GrammaTech's proprietary technology and appears to no longer exist."), "."), /* @__PURE__ */ React3.createElement("p", null, "A major challenge for slicing is addressing the underlying program analysis problems. At a high level, slicing is about dataflow --- if ", /* @__PURE__ */ React3.createElement($2, null, "x"), " is relevant, then any means by which data flows into ", /* @__PURE__ */ React3.createElement($2, null, "x"), " are also relevant. In today's programming languages, analyzing dataflow is difficult because of the interaction of two features: functions and pointers. For example, imagine slicing a value in a function ", /* @__PURE__ */ React3.createElement($2, null, "f"), " which calls a function ", /* @__PURE__ */ React3.createElement($2, null, "g"), ". In a language without side-effects, then the only relevance ", /* @__PURE__ */ React3.createElement($2, null, "g"), " could possibly have in", " ", /* @__PURE__ */ React3.createElement($2, null, "f"), " is its return value. But in a language that allows effects such as mutation on pointers, ", /* @__PURE__ */ React3.createElement($2, null, "g"), " could modify data used within ", /* @__PURE__ */ React3.createElement($2, null, "f"), ", requiring a pointer analysis. Moreover, if ", /* @__PURE__ */ React3.createElement($2, null, "f"), " is a higher-order function parameterized on ", /* @__PURE__ */ React3.createElement($2, null, "g"), ", then the slice must consider all the possible functions that ", /* @__PURE__ */ React3.createElement($2, null, "g"), " could be, i.e. control-flow analysis."), /* @__PURE__ */ React3.createElement("p", null, "The standard solution for analyzing programs with pointers and functions is", " ", /* @__PURE__ */ React3.createElement("em", null, "whole-program analysis"), ". That is, for a given function of interest, analyze the definitions of all of the function's callers and callees in the current codebase. However, whole-program analysis suffers from a few logistical and conceptual issues:"), /* @__PURE__ */ React3.createElement("ul", null, /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement("em", null, "Analysis time scales with the size of the whole program:"), " the time complexity of whole-program analysis scales either polynomially or exponentially with the number of call sites in the program, depending on context-sensitivity ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "might2010resolving"
  }), ". In practice, this means more complex codebases can take substantially longer to analyze. For instance, the recent PSEGPT pointer analysis tool ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "zhao2018parallel"
  }), " takes 1 second on a codebase of 282,000 lines of code and 3 minutes on a codebase of 2.2 million lines of code."), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement("em", null, "Analysis requires access to source code for the whole program:"), " an assumption of analyzing a whole program is that a whole program is actually accessible. However, many programs use libraries that are shipped as pre-compiled objects with no source code, either for reasons of efficiency or intellectual property."), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement("em", null, "Analysis results are anti-modular:"), " when analyzing a particular function, relying on calling contexts to analyze the function's inputs means that any results are not universal. Calling-context-sensitive analysis determine whether two pointers alias", " ", /* @__PURE__ */ React3.createElement("em", null, "in the context of the broader codebase"), ", so alias analysis results can change due to modifications in code far away from the current module.")), /* @__PURE__ */ React3.createElement("p", null), /* @__PURE__ */ React3.createElement("p", null, "These issues are not new --- ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "rountev1999data",
    f: true
  }), " and", " ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "cousot2002modular",
    f: true
  }), " observed the same two decades ago when arguing for modular static analysis. The key insight arising from their research is that static analysis can be modularized by computing ", /* @__PURE__ */ React3.createElement("em", null, "symbolic procedure summaries"), ". For instance,", " ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "yorsh2008generating",
    f: true
  }), " show how to automatically summarize which inputs and outputs are possibly null for a given Java function. The analysis is modular because a function's summary can be computed only given the summaries, and not definitions, of callees in the function. In such prior work, the language of symbolic procedure summaries has been defined in a separate formal system from the programming language being analyzed, such as the micro-transformer framework of ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "yorsh2008generating",
    f: true
  }), "."), /* @__PURE__ */ React3.createElement("p", null, "Our work begins with the observation:", " ", /* @__PURE__ */ React3.createElement("em", null, "function type signatures are symbolic procedure summaries"), ". The more expressive a language's type system, the more behavior that can be summarized by a type. Nearly all work on program slicing, dataflow analysis, and procedure summaries has operated on C, Java, or equivalents. These languages have impoverished type systems, and so any interesting static analysis requires a standalone abstract interpreter. However, if a language's type system were expressive enough to encode information about dataflow, then a function's type signature could be used to reason about the aliasing and side effects needed for slicing. Moreover, a function's type signature is required information for a compiler to export when building a library. Using the type system for dataflow analysis therefore obviates the logistical challenge of integrating an external analysis tool into a complex build system."), /* @__PURE__ */ React3.createElement("p", null, "Today, the primary technique for managing dataflow with types is ", /* @__PURE__ */ React3.createElement("em", null, "ownership"), ". Ownership is a concept that has emerged from several intersecting lines of research on linear logic ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "girard1987linear"
  }), ", class-based alias management", " ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "clarke1998ownership"
  }), ", and region-based memory management", " ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "grossman2002region"
  }), ". Generally, ownership refers to a system where values are owned by an entity, which can temporarily or permanently transfer ownership to other entities. The type system then statically tracks the flow of ownership between entities. Ownership-based type systems enforce the invariant that values are not simultaneously aliased and mutated, either for the purposes of avoiding memory errors, data races, or abstraction violations."), /* @__PURE__ */ React3.createElement("p", null, "Our thesis is that ownership can modularize program slicing by using types to compute a provably sound and reasonably precise approximation of the necessary dataflow information. We build this thesis in five parts:"), /* @__PURE__ */ React3.createElement("ol", null, /* @__PURE__ */ React3.createElement("li", null, "We provide an intuition for the relationship between ownership and slicing by describing how ownership works in Rust, the only industrial-grade ownership-based programming language today (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:background"
  }), ")."), /* @__PURE__ */ React3.createElement("li", null, "We formalize an algorithm for modular static slicing as an extension to the type system of Oxide ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "weiss2019oxide"
  }), ", a formal model of Rust's static and dynamic semantics (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:model"
  }), " and ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:algorithm"
  }), ")."), /* @__PURE__ */ React3.createElement("li", null, "We prove the soundness of this algorithm as a form of noninterference, building on the connection between slicing and information flow established by", " ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "abadi1999core",
    f: true
  }), " (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:soundness"
  }), " and ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:appendix"
  }), ")."), /* @__PURE__ */ React3.createElement("li", null, "We describe an implementation of the slicing algorithm for Rust, translating the core insights of the algorithm to work on a lower-level control-flow graph (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:implementation"
  }), ")"), /* @__PURE__ */ React3.createElement("li", null, "We evaluate the precision of the modular Rust slicer against a whole-program slicer on a dataset of 10 codebases with a total of 280k LOC. We find that modular slices are the same size as whole-program slices 95.4% of the time, and are on average 7.6% larger in the remaining 4.6% of cases (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:evaluation"
  }), ")."))), /* @__PURE__ */ React3.createElement(Section, {
    title: "Principles",
    name: "sec:background"
  }, /* @__PURE__ */ React3.createElement("p", null, "A backwards static slice is the subset of a program that could influence a particular value (backwards) under any possible execution (static). A slice is defined with respect to a slicing criterion, which is a variable at a particular point in a program. In this section, we provide an intuition for how slices interact with different features of the Rust programming language, namely: places (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:places"
  }), "), references (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:pointers"
  }), "), function calls (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:funcalls"
  }), "), and interior mutability (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:intmut"
  }), ").", " "), /* @__PURE__ */ React3.createElement(SubSection, {
    title: "Places",
    name: "sec:places"
  }, /* @__PURE__ */ React3.createElement(Wrap, {
    align: "right"
  }, /* @__PURE__ */ React3.createElement(SliceListing, {
    code: `let mut x = 1;
let y = 2;
let z = 3;
x = y;
println!("{}", @x@);`
  })), /* @__PURE__ */ React3.createElement("p", null, "A place is a reference to a concrete piece of data in memory, like a variable ", /* @__PURE__ */ React3.createElement(C, null, "x"), " or path into a data structure ", /* @__PURE__ */ React3.createElement(C, null, "x.field"), ". Slices on places are defined by bindings, mutation, and control flow."), /* @__PURE__ */ React3.createElement("p", null, "For instance, the Rust snippet on the right shows the slice in orange of a place in green. The assignment ", /* @__PURE__ */ React3.createElement(C, null, "x = y"), " means ", /* @__PURE__ */ React3.createElement(C, null, "y"), " is relevant for the slice, so the statement", " ", /* @__PURE__ */ React3.createElement(C, null, "let y = 2"), " is relevant as well. Because ", /* @__PURE__ */ React3.createElement(C, null, "z"), " is not used in the computation of", " ", /* @__PURE__ */ React3.createElement(C, null, "x"), ", then ", /* @__PURE__ */ React3.createElement(C, null, "let z = 3"), ". is not relevant. Additionally, because ", /* @__PURE__ */ React3.createElement(C, null, "x = y"), " ", "overwrites the previous value of ", /* @__PURE__ */ React3.createElement(C, null, "x"), ", then the original assignment ", /* @__PURE__ */ React3.createElement(C, null, "x = 1"), " is not relevant either."), /* @__PURE__ */ React3.createElement(Wrap, {
    align: "left"
  }, /* @__PURE__ */ React3.createElement(SliceListing, {
    code: `let mut x = 1;
let mut y = 2;
if y > 0 { x = 3; } 
else     { y = 4; }
println!("{}", @x@);`
  })), /* @__PURE__ */ React3.createElement("p", null, "If a mutation is conditioned on a predicate (as in line 3 in the snippet on the left) then the predicate is relevant to the mutated place. In this example, because ", /* @__PURE__ */ React3.createElement(C, null, "x = 3"), " is only executed if ", /* @__PURE__ */ React3.createElement(C, null, "y > 0"), ", then the value of ", /* @__PURE__ */ React3.createElement(C, null, "y"), " (at the time-of-check) is relevant to the value of ", /* @__PURE__ */ React3.createElement(C, null, "x"), "."), /* @__PURE__ */ React3.createElement("p", null, "Slices on composite data structures are defined by whether a mutation conflicts with a particular path into the data structure. For example, consider slicing on a tuple as in the three snippets below (note that ", /* @__PURE__ */ React3.createElement(C, null, "t.n"), " gets the ", /* @__PURE__ */ React3.createElement($2, null, "n"), "-th field of the tuple", " ", /* @__PURE__ */ React3.createElement(C, null, "t"), "):"), /* @__PURE__ */ React3.createElement(Row, null, /* @__PURE__ */ React3.createElement(SliceListing, {
    code: r3`let mut t = (0, 1, 2);
t = (3, 4, 5);
t.0 = 6;
t.1 = 7;
println!("{:?}", @t@);`
  }), /* @__PURE__ */ React3.createElement(SliceListing, {
    code: r3`let mut t = (0, 1, 2);
t = (3, 4, 5);
t.0 = 6;
t.1 = 7;
println!("{}", @t.0@);`
  }), /* @__PURE__ */ React3.createElement(SliceListing, {
    code: r3`let mut t = (0, 1, 2);
t = (3, 4, 5);
t.0 = 6;
t.1 = 7;
println!("{}", @t.2@);`
  })), /* @__PURE__ */ React3.createElement("p", null, "In this program, when slicing on ", /* @__PURE__ */ React3.createElement(C, null, "t"), ", changing the value of a field of a structure changes the value of the whole structure, so ", /* @__PURE__ */ React3.createElement(C, null, "t.1 = 7"), " is part of the slice on", " ", /* @__PURE__ */ React3.createElement(C, null, "t"), ". However, when slicing on ", /* @__PURE__ */ React3.createElement(C, null, "t.0"), ", the path ", /* @__PURE__ */ React3.createElement(C, null, "t.0"), " is disjoint from the path ", /* @__PURE__ */ React3.createElement(C, null, "t.1"), ", so ", /* @__PURE__ */ React3.createElement(C, null, "t.1 = 7"), " is not part of the slice on ", /* @__PURE__ */ React3.createElement(C, null, "t.0"), ". Similarly, when slicing on ", /* @__PURE__ */ React3.createElement(C, null, "t.2"), ", the only relevant assignment is ", /* @__PURE__ */ React3.createElement(C, null, "t = (3, 4, 5)"), ". More generally, a place conflicts with another place if either's path is a prefix of the other's. For instance, ", /* @__PURE__ */ React3.createElement(C, null, "t.0"), " conflicts with both ", /* @__PURE__ */ React3.createElement(C, null, "t"), " (parent) and ", /* @__PURE__ */ React3.createElement(C, null, "t.0.1"), " ", "(child) but not ", /* @__PURE__ */ React3.createElement(C, null, "t.1"), " (sibling). This leads to the first slicing principle:"), /* @__PURE__ */ React3.createElement(Principle, {
    type: "places",
    text: "A mutation to a place is a mutation to all conflicting places."
  }), /* @__PURE__ */ React3.createElement("p", null, "This principle provides an intuition for making an algorithm that constructs slices. For instance, take the last example above on the left. On line 4, when ", /* @__PURE__ */ React3.createElement(C, null, "t.1"), " is mutated, that mutation is registered as part of the slice on every conflicting place, specifically", " ", /* @__PURE__ */ React3.createElement(C, null, "t"), " and ", /* @__PURE__ */ React3.createElement(C, null, "t.1"), ".")), /* @__PURE__ */ React3.createElement(SubSection, {
    title: "References",
    name: "sec:pointers"
  }, /* @__PURE__ */ React3.createElement("p", null, "Pointers are the first major challenge for slicing. A mutation to a dereferenced pointer is a mutation to any place that is possibly pointed-to, so such places must be known to the slicer. For example:"), /* @__PURE__ */ React3.createElement(Wrap, {
    align: "right"
  }, /* @__PURE__ */ React3.createElement(SliceListing, {
    code: r3`let mut x = 1;
let y = &mut x;
*y = 2;
let z = &x;
println!("{}", @*z@);`
  })), /* @__PURE__ */ React3.createElement("p", null, 'Rust has two distinct types of pointers, which are called "references" to distinguish them from "raw pointers" with C-like behavior (discussed in ', /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:intmut"
  }), "). For a given type ", /* @__PURE__ */ React3.createElement(C, null, "T"), ", there are immutable references of type ", /* @__PURE__ */ React3.createElement(C, null, "&T"), ", and mutable references of type ", /* @__PURE__ */ React3.createElement(C, null, "&mut T"), " which correspond respectively to the expressions", " ", /* @__PURE__ */ React3.createElement(C, null, "&x"), " and ", /* @__PURE__ */ React3.createElement(C, null, "&mut x"), ". Because ", /* @__PURE__ */ React3.createElement(C, null, "y"), " points to ", /* @__PURE__ */ React3.createElement(C, null, "x"), ", then the mutation through ", /* @__PURE__ */ React3.createElement(C, null, "y"), " is relevant to the read of ", /* @__PURE__ */ React3.createElement(C, null, "*z"), ". We refer to the left-hand side of assignment statements like ", /* @__PURE__ */ React3.createElement(C, null, "*y"), ' as "place expressions", since they could include dereferences.'), /* @__PURE__ */ React3.createElement("p", null, "The task of determining what a reference can point-to is called ", /* @__PURE__ */ React3.createElement("em", null, "pointer analysis"), " ", ". While many methods exist for pointer analysis ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "smaragdakis2015pointer"
  }), ", our first key insight is that Rust's ownership types implicitly perform a kind of modular pointer analysis that we can leverage for slicing. To understand why, we first need to describe two ingredients: the goal, i.e. what ownership is trying to accomplish, and the mechanism, i.e. how ownership-checking is implemented in the type system."), /* @__PURE__ */ React3.createElement("p", null, "The core goal of ownership is eliminating simultaneous aliasing and mutation. In Rust, achieving this goal enables the use of references without garbage collection while retaining memory safety. For instance, these three classes of errors are all caught at compile-time:"), /* @__PURE__ */ React3.createElement(Row, null, /* @__PURE__ */ React3.createElement(Listing2, {
    code: r3`// Dangling reference
let p = {
  let x = 1; &x
};
let y = *p;`
  }), /* @__PURE__ */ React3.createElement(Listing2, {
    code: r3`// Use-after-free
let d = tempdir();
let d2 = &d;
d.close();
let p = d2.path();`
  }), /* @__PURE__ */ React3.createElement(Listing2, {
    code: r3`// Iterator invalidation
let mut v = vec![1,2];
for x in v.iter() {
  v.push(*x);
}`
  })), /* @__PURE__ */ React3.createElement("p", null, "From left-to-right: the dangling references is caught because ", /* @__PURE__ */ React3.createElement(C, null, "x"), " is deallocated at the end of scope on line 4, which is a mutation, conflicting with the alias ", /* @__PURE__ */ React3.createElement(C, null, "&x"), ". The use-after-free is caught because ", /* @__PURE__ */ React3.createElement(C, null, "d.close()"), " requires ownership of ", /* @__PURE__ */ React3.createElement(C, null, "d"), ", which prevents an alias ", /* @__PURE__ */ React3.createElement(C, null, "d2"), " from being live. The iterator invalidation case is subtler:", " ", /* @__PURE__ */ React3.createElement(C, null, "x"), " is a pointer to data within ", /* @__PURE__ */ React3.createElement(C, null, "v"), ". However, ", /* @__PURE__ */ React3.createElement(C, null, "v.push(*x)"), " could resize", " ", /* @__PURE__ */ React3.createElement(C, null, "v"), " which would copy/deallocate all vector elements to a new heap location, invalidating all pointers to ", /* @__PURE__ */ React3.createElement(C, null, "v"), ". Hence ", /* @__PURE__ */ React3.createElement(C, null, "v.push(*x)"), " is a simultaneous mutation and alias of the vector."), /* @__PURE__ */ React3.createElement("p", null, "Catching these errors requires understanding which places are pointed by which references. For instance, knowing that ", /* @__PURE__ */ React3.createElement(C, null, "x"), " points to an element of ", /* @__PURE__ */ React3.createElement(C, null, "v"), " and not just any arbitrary ", /* @__PURE__ */ React3.createElement(C, null, "i32"), ". The key mechanism behind these ownership checks is", " ", /* @__PURE__ */ React3.createElement("em", null, "lifetimes"), "."), /* @__PURE__ */ React3.createElement(Wrap, {
    align: "left"
  }, /* @__PURE__ */ React3.createElement(Listing2, {
    code: r3`let mut x: i32 = 1;
let y: &'1 i32 = &'0 mut x;
*y = 2;
let z: &'3 i32 = &'2 x;
println!("{}", *z);`
  })), /* @__PURE__ */ React3.createElement("p", null, "Each reference expression and type has a corresponding lifetime, written explicitly in the syntax ", /* @__PURE__ */ React3.createElement(C, null, "'n"), " on the left, where ", /* @__PURE__ */ React3.createElement(C, null, "n"), ' is an arbitrary and unique number. The name "lifetime" implies a model of lifetimes as the live range of the reference. Prior work on region-based memory management like ', /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: "tofte1997region"
  }), " and", " ", /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: "grossman2002region"
  }), " use this model."), /* @__PURE__ */ React3.createElement("p", null, "However, recent work from ", /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: "polonius"
  }), " and ", /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: "weiss2019oxide"
  }), ' have devised an alternative model of lifetimes as "provenances" or "origins" that more directly correspond to a pointer analysis. In essence, a lifetime is the set of places that a reference could point-to. For the above example, that would be ', /* @__PURE__ */ React3.createElement(C, null, "'n = x "), " for all", " ", /* @__PURE__ */ React3.createElement(C, null, "n"), ", because each reference points to ", /* @__PURE__ */ React3.createElement(C, null, "x"), ". As a more interesting example, consider the code on the left."), /* @__PURE__ */ React3.createElement(Wrap, {
    align: "left"
  }, /* @__PURE__ */ React3.createElement(Listing2, {
    code: r3`let mut x = 1;
let mut y = 2;
let z: &'2 mut i32 = if true {
  &'0 mut x
} else {
  &'1 mut y
};
let w: &'4 mut i32 = &'3 mut *z;
*w = 1;`
  })), /* @__PURE__ */ React3.createElement("p", null, "There, lifetimes for borrow expressions are assigned to the place being borrowed, so", " ", /* @__PURE__ */ React3.createElement(C, null, "'0 = x "), " and ", /* @__PURE__ */ React3.createElement(C, null, "'1 = y "), ". Because ", /* @__PURE__ */ React3.createElement(C, null, "z"), " could be assigned to either reference, then ", /* @__PURE__ */ React3.createElement(C, null, `'2 = '0 \u222A '1 = {x, y}`), ". An expression of the form ", /* @__PURE__ */ React3.createElement(C, null, "& *p"), ' is called a "reborrow", as the underlying address is being passed from one reference to another. To register that a reference is reborrowed, the reborrowed place is also added to the lifetime, so ', /* @__PURE__ */ React3.createElement(C, null, `'3 = '4 = {x, y, *z}`), ". More generally:"), /* @__PURE__ */ React3.createElement(Principle, {
    type: "references",
    text: "The lifetime of a reference contains all potential aliases of what the reference points-to."
  }), /* @__PURE__ */ React3.createElement("p", null, "In the context of slicing, then to determine which places could be modified by a particular assignment, one only needs to look up the aliases in the lifetime of references. For instance, ", /* @__PURE__ */ React3.createElement(C, null, "*w = 1"), " would be part of a slice on ", /* @__PURE__ */ React3.createElement(C, null, "*z"), ", because", " ", /* @__PURE__ */ React3.createElement(C, null, "*z"), " is in the lifetime ", /* @__PURE__ */ React3.createElement(C, null, "'4"), " of ", /* @__PURE__ */ React3.createElement(C, null, "w"), ".")), /* @__PURE__ */ React3.createElement(SubSection, {
    title: "Function calls",
    name: "sec:funcalls"
  }, /* @__PURE__ */ React3.createElement("p", null, "The other major challenge for slicing is function calls. For instance, consider slicing a call to an arbitrary function ", /* @__PURE__ */ React3.createElement(C, null, "f"), " with various kinds of inputs:", /* @__PURE__ */ React3.createElement(Footnote, null, "Why is ", /* @__PURE__ */ React3.createElement(C, null, "String::from"), " needed? The literal ", /* @__PURE__ */ React3.createElement(C, null, '"Hello world"'), " has type", " ", /* @__PURE__ */ React3.createElement(C, null, "&'static str"), ", meaning an immutable reference to the binary's string pool which lives forever. The function ", /* @__PURE__ */ React3.createElement(C, null, "String::from"), " converts the immutable reference into a value of type ", /* @__PURE__ */ React3.createElement(C, null, "String"), ", which stores its contents on the heap and allows the string to be mutated.")), /* @__PURE__ */ React3.createElement(Wrap, {
    align: "left"
  }, /* @__PURE__ */ React3.createElement(Listing2, {
    code: r3`let x = String::from("x");
let y = String::from("y");
let mut z = String::from("z");
let w = f(x, &y, &mut z);
println!("{} {} {}", y, z, w);`
  })), /* @__PURE__ */ React3.createElement("p", null, "The standard approach to slicing ", /* @__PURE__ */ React3.createElement(C, null, "f"), " would be to inspect the definition of ", /* @__PURE__ */ React3.createElement(C, null, "f"), ", and recursively slice it by translating the slicing criteria from caller to callee (e.g. see ", /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: "weiser1982programmers"
  }), " for an example). However, our goal is to avoid using the definition of ", /* @__PURE__ */ React3.createElement(C, null, "f"), " (i.e. a whole-program analysis) for the reasons described in ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:intro"
  }), ".", " "), /* @__PURE__ */ React3.createElement("p", null, "To modularly slice through function calls, we need to approximate the effects of ", /* @__PURE__ */ React3.createElement(C, null, "f"), " ", "in a manner that is sound, but also as precise as possible. Put another way, what mutations could possibly occur as a result of calling ", /* @__PURE__ */ React3.createElement(C, null, "f"), "? Consider the three cases that arise in the code above."), /* @__PURE__ */ React3.createElement("ul", null, /* @__PURE__ */ React3.createElement("li", null, "Passing a value ", /* @__PURE__ */ React3.createElement(C, null, "x"), " of type ", /* @__PURE__ */ React3.createElement(C, null, "String"), " (or generally of type ", /* @__PURE__ */ React3.createElement(C, null, "T"), ") moves the value into ", /* @__PURE__ */ React3.createElement(C, null, "f"), ". Therefore it is an ownership error to refer to ", /* @__PURE__ */ React3.createElement(C, null, "x"), " after calling ", /* @__PURE__ */ React3.createElement(C, null, "f"), " and we do not need to consider slices on ", /* @__PURE__ */ React3.createElement(C, null, "x"), " after ", /* @__PURE__ */ React3.createElement(C, null, "f"), "."), /* @__PURE__ */ React3.createElement("li", null, "Passing a value ", /* @__PURE__ */ React3.createElement(C, null, "y"), " of type ", /* @__PURE__ */ React3.createElement(C, null, "&String"), " (or ", /* @__PURE__ */ React3.createElement(C, null, "&T"), ") passes an immutable reference. Immutable references cannot be mutated, therefore ", /* @__PURE__ */ React3.createElement(C, null, "y"), " cannot change in", " ", /* @__PURE__ */ React3.createElement(C, null, "f"), ".", /* @__PURE__ */ React3.createElement(Footnote, null, "A notable detail to the safety of immutable references is that immutability is transitive. For instance, if ", /* @__PURE__ */ React3.createElement(C, null, "b = &mut a"), " and ", /* @__PURE__ */ React3.createElement(C, null, "c = &b"), ", then ", /* @__PURE__ */ React3.createElement(C, null, "a"), " is guaranteed not to be mutated through ", /* @__PURE__ */ React3.createElement(C, null, "c"), ". This stands in contrast to other languages with pointers like C and C++ where the ", /* @__PURE__ */ React3.createElement(C, null, "const"), " keyword only protects values from mutation at the top-level, and not into the interior fields.")), /* @__PURE__ */ React3.createElement("li", null, "Passing a value ", /* @__PURE__ */ React3.createElement(C, null, "z"), " of type ", /* @__PURE__ */ React3.createElement(C, null, "&mut String"), " (or ", /* @__PURE__ */ React3.createElement(C, null, "&mut T"), ") passes a mutable reference, which could possibly be mutated. This case is therefore the only observable of effect ", /* @__PURE__ */ React3.createElement(C, null, "f"), " apart from its return value.")), /* @__PURE__ */ React3.createElement("p", null, "Without inspecting ", /* @__PURE__ */ React3.createElement(C, null, "f"), ", we cannot know how a mutable reference is modified, so we have to conservatively assume that every argument was used as input to a mutation. Therefore the modular slice of each variable looks as in the snippets below:"), /* @__PURE__ */ React3.createElement(Row, null, /* @__PURE__ */ React3.createElement(SliceListing, {
    prelude: "let f = |x: String, y: &String, z: &mut String| -> usize { 0 };",
    code: r3`let x = String::from("x");
let y = String::from("y");
let mut z = String::from("z");
let w = f(x, &y, &mut z);
println!("{}", @y@);`
  }), /* @__PURE__ */ React3.createElement(SliceListing, {
    prelude: "let f = |x: String, y: &String, z: &mut String| -> usize { 0 };",
    code: r3`let x = String::from("x");
let y = String::from("y");
let mut z = String::from("z");
let w = f(x, &y, &mut z);
println!("{}", @z@);`
  }), /* @__PURE__ */ React3.createElement(SliceListing, {
    prelude: "let f = |x: String, y: &String, z: &mut String| -> usize { 0 };",
    code: r3`let x = String::from("x");
let y = String::from("y");
let mut z = String::from("z");
let w = f(x, &y, &mut z);
println!("{}", @w@);`
  })), /* @__PURE__ */ React3.createElement("p", null, "Note that like ", /* @__PURE__ */ React3.createElement(C, null, "z"), " (middle), the return value ", /* @__PURE__ */ React3.createElement(C, null, "w"), " (right) is also assumed to be influenced by every input to ", /* @__PURE__ */ React3.createElement(C, null, "f"), ". Implicit in these slices are additional assumptions about the limitations of ", /* @__PURE__ */ React3.createElement(C, null, "f"), ". For example, in C, a function could manufacture a pointer to the stack frame above it and mutate the values, meaning ", /* @__PURE__ */ React3.createElement(C, null, "f"), " could mutate", " ", /* @__PURE__ */ React3.createElement(C, null, "y"), " (even if ", /* @__PURE__ */ React3.createElement(C, null, "y"), " was not an input!). Similarly, functions could potentially read arbitrary data (e.g. global variables) that would influence mutations apart from just the arguments.", " "), /* @__PURE__ */ React3.createElement("p", null, "However, allowing such pointer manipulation would easily break ownership safety, since fundamentally it permits unchecked aliasing. Hence, our principle:"), /* @__PURE__ */ React3.createElement(Principle, {
    type: "function calls",
    text: "When calling a function, (a) only mutable references in the arguments can be mutated, and (b) the mutations and return value are only influenced by the arguments."
  }), /* @__PURE__ */ React3.createElement("p", null, "This principle is essentially a worst-case approximation to the function's effects. It is the core of how we can modularly slice programs, because a function's definition does not have to be inspected to analyze what it can mutate.", " "), /* @__PURE__ */ React3.createElement("p", null, "A caveat to this principle is global variables: (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "prin:function calls"
  }), "-a) is not true with mutable globals, and (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "prin:function calls"
  }), "-b) is not true with read-only globals. Mutable globals are disallowed by the rules of ownership, as they are implicitly aliased and hence disallowed from being mutable. However, read-only globals are ownership-safe (and hence permitted in Rust). For simplicity we do not consider read-only globals in this work."), /* @__PURE__ */ React3.createElement("p", null, "Another notable detail is the interaction of function calls and lifetimes. Pointer analysis, like slicing, has historically been done via whole-program analysis for maximum precision. However, Rust can analyze lifetimes (and subsequently what references point-to) modularly just by looking at the type signature of a called function using", " ", /* @__PURE__ */ React3.createElement("em", null, "lifetime parameters"), " . Consider the function ", /* @__PURE__ */ React3.createElement(C, null, "Vec::get_mut"), " that returns a mutable reference to an element of a vector. For instance, ", /* @__PURE__ */ React3.createElement(C, null, "vec![5, 6].get_mut(0)"), " ", "returns a mutable reference to the value 5. This function has the type signature:"), /* @__PURE__ */ React3.createElement("center", {
    style: { margin: "1rem 0" }
  }, /* @__PURE__ */ React3.createElement(C, null, `Vec::get_mut   :   forall 'a, T . (&'a mut Vec<T>, usize) -> &'a mut T`)), /* @__PURE__ */ React3.createElement("p", null, "Because this type signature is parametric in the lifetime ", /* @__PURE__ */ React3.createElement(C, null, "'a"), ", it can express the constraint that the output reference ", /* @__PURE__ */ React3.createElement(C, null, "&'a mut T"), " must have the same lifetime as the input reference ", /* @__PURE__ */ React3.createElement(C, null, `&'a mut Vec<T>`), ". Therefore the returned pointer is known to point to the same data as the input pointer, but without inspecting the definition of", " ", /* @__PURE__ */ React3.createElement(C, null, "get_mut"), ".")), /* @__PURE__ */ React3.createElement(SubSection, {
    title: "Interior mutability",
    name: "sec:intmut"
  }, /* @__PURE__ */ React3.createElement("p", null, 'The previous sections describe a slicing strategy for the subset of Rust known as "safe Rust", that is programs which strictly adhere to the rules of ownership. Importantly, Rust also has the ', /* @__PURE__ */ React3.createElement(C, null, "unsafe"), " feature that gives users access to raw pointers, or pointers with similar unchecked behavior to C. Most commonly, ", /* @__PURE__ */ React3.createElement(C, null, "unsafe"), " code is used to implement APIs that satisfy ownership, but not in a manner that is deducible by the type system. For example, shared mutable state between threads:"), /* @__PURE__ */ React3.createElement(Wrap, {
    align: "left"
  }, /* @__PURE__ */ React3.createElement(Listing2, {
    code: r3`let value = Arc::new(Mutex::new(0));
let value_ref = value.clone();
thread::spawn(move || { 
  *value_ref.lock().unwrap() += 1; 
}).join().unwrap();
assert!(*value.lock().unwrap() == 1);`
  })), /* @__PURE__ */ React3.createElement("p", null, "In this snippet, two threads have ownership over two values of type", " ", /* @__PURE__ */ React3.createElement(C, null, `Arc<Mutex<i32>>`), " which internally point to the same number. Both threads can call ", /* @__PURE__ */ React3.createElement(C, null, "Mutex::lock"), " which takes an immutable reference to an ", /* @__PURE__ */ React3.createElement(C, null, `&Mutex<i32>`), " ", "and returns a mutable reference ", /* @__PURE__ */ React3.createElement(C, null, "&mut i32"), " to the data inside.", /* @__PURE__ */ React3.createElement(Footnote, null, "Technically the returned type is a ", /* @__PURE__ */ React3.createElement(C, null, `LockResult<MutexGuard<'a, i32>>`), " but the distinction isn't relevant here."), " ", "This nominally violates ownership, as the data is aliased (shared by two threads) and mutable (both can mutate)."), /* @__PURE__ */ React3.createElement("p", null, "The mutex is ownership-safe only because its implementation ensures that both threads cannot ", /* @__PURE__ */ React3.createElement("em", null, "simultaneously"), " access the underlying value in accordance with the system mutex's semantics. For our purposes, the aliasing between ", /* @__PURE__ */ React3.createElement(C, null, "value"), " and", " ", /* @__PURE__ */ React3.createElement(C, null, "value_ref"), " is not possible to observe using the type system alone. For example, in our algorithm, slicing on ", /* @__PURE__ */ React3.createElement(C, null, "value"), " would ", /* @__PURE__ */ React3.createElement("em", null, "not"), " include mutations to", " ", /* @__PURE__ */ React3.createElement(C, null, "value_ref"), ". This is because the data inside the mutex has type ", /* @__PURE__ */ React3.createElement(C, null, "*mut i32"), " (a raw pointer), and without a lifetime attached, our algorithm has no way to determine whether ", /* @__PURE__ */ React3.createElement(C, null, "value"), " and ", /* @__PURE__ */ React3.createElement(C, null, "value_ref"), " are aliases just by inspecting their types."), /* @__PURE__ */ React3.createElement("p", null, "More broadly, modular slicing is only sound for safe Rust. The point of this work is to say: when a program can be statically determined to satisfy the rules of ownership, then modular slicing is sound. The principles above help clarify the specific assumptions made possible by ownership, which are otherwise impossible to make in languages like C or Java.", " ", /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: "astrauskas2020programmers"
  }), " found that 76.4% of published Rust projects contain no unsafe code, suggesting that safe Rust is more common than not. However, their study does not account for safe Rust built on internally-unsafe abstractions like", " ", /* @__PURE__ */ React3.createElement(C, null, "Mutex"), ", so it is difficult to estimate the true likelihood of soundness in practice. We discuss the issue of slicing with unsafe code further in", " ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:whole-vs-mod"
  }), "."))), /* @__PURE__ */ React3.createElement(Section, {
    title: "Formal Model",
    name: "sec:model"
  }, /* @__PURE__ */ React3.createElement("p", null, "To build an algorithm from these principles, we first need a formal model to describe and reason about the underlying language. Rather than devise our own, we build on the work of", " ", /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: "weiss2019oxide"
  }), " : Oxide is a model of (safe) Rust's surface language with a formal static and dynamic semantics, along with a proof of syntactic type soundness. Importantly, Oxide uses a provenance model of lifetimes which we leverage for our slicing algorithm.", " "), /* @__PURE__ */ React3.createElement("p", null, "We will incrementally introduce the aspects of Oxide's syntax and semantics as necessary to understand our principles and algorithm. We describe Oxide's syntax (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:syn"
  }), "), static semantics (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:statsem"
  }), ") and dynamic semantics (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:dynsem"
  }), "), and then apply these concepts to formalize the slicing principles of the previous section (", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:formal_principles"
  }), ")."), /* @__PURE__ */ React3.createElement(SubSection, {
    title: "Syntax",
    name: "sec:syn"
  }, /* @__PURE__ */ React3.createElement("p", null, /* @__PURE__ */ React3.createElement(Ref, {
    name: "fig:oxide_syntax"
  }), " shows a subset of Oxide's syntax along with a labeled example. An Oxide program consists of a set of functions ", /* @__PURE__ */ React3.createElement($2, null, r3`\fenv`), ' (the "global environment"), where each function body is an expression ', /* @__PURE__ */ React3.createElement($2, null, r3`\expr`), " ."), /* @__PURE__ */ React3.createElement(Figure, {
    name: "fig:oxide_syntax"
  }, /* @__PURE__ */ React3.createElement(Subfigure, {
    name: "fig:oxide_syntax"
  }, /* @__PURE__ */ React3.createElement(Oxide.Bnf, {
    layout: { columns: 2, cutoff: 9 }
  }), /* @__PURE__ */ React3.createElement(Expandable, {
    prompt: /* @__PURE__ */ React3.createElement(React3.Fragment, null, "Rest of the grammar...")
  }, /* @__PURE__ */ React3.createElement(OxideExtra.Bnf, null)), /* @__PURE__ */ React3.createElement(Caption, null, "Subset of Oxide syntax, reproduced from ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "weiss2019oxide",
    f: true,
    ex: "p. 8"
  }), ". The only difference in this subset is that closures are eliminated and functions are simplified to take one argument.")), /* @__PURE__ */ React3.createElement(Subfigure, {
    name: "fig:oxide_syntax_example"
  }, /* @__PURE__ */ React3.createElement(SyntaxDiagram, null), /* @__PURE__ */ React3.createElement(Caption, null, "Syntactic forms and corresponding metavariables labeled in context of an example")), /* @__PURE__ */ React3.createElement(Caption, null, "Formal elements of Oxide and their explanation (excerpts).")), /* @__PURE__ */ React3.createElement("p", null, "The syntax is largely the same as Rust's with a few exceptions:"), /* @__PURE__ */ React3.createElement("ul", null, /* @__PURE__ */ React3.createElement("li", null, 'Lifetimes are called "provenances", and they are both explicit in expressions and types throughout the program, and initially bound via ', /* @__PURE__ */ React3.createElement($2, null, r3`\msf{letprov}`), " expressions or as function parameters."), /* @__PURE__ */ React3.createElement("li", null, "Rather than having immutable references ", /* @__PURE__ */ React3.createElement(C, null, "&'a \u03C4"), " and mutable references", " ", /* @__PURE__ */ React3.createElement(C, null, "&'a mut \u03C4"), ', Oxide calls them "shared" references', " ", /* @__PURE__ */ React3.createElement($2, null, r3`\tysref{\ownqshrd}{\prov}{\ty}`), ' and "unique" references', " ", /* @__PURE__ */ React3.createElement($2, null, r3`\tysref{\ownquniq}{\prov}{\ty}`), " ."), /* @__PURE__ */ React3.createElement("li", null, 'Provenances are divided into "concrete" (', /* @__PURE__ */ React3.createElement($2, null, r3`\concrprov`), ') and "abstract" (', /* @__PURE__ */ React3.createElement($2, null, r3`\abstrprov`), "). Concrete provenances are used by borrow expressions, and abstract provenances are function parameters used for inputs with reference type."))), /* @__PURE__ */ React3.createElement(SubSection, {
    title: "Static semantics",
    name: "sec:statsem"
  }, /* @__PURE__ */ React3.createElement("p", null, /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:tc"
  }, "Expressions are typechecked via the judgment ", /* @__PURE__ */ React3.createElement($2, null, r3`\tc{\fenv}{\tyenv}{\stackenv}{\expr}{\ty}{\stackenv'}`), ', read as: "', /* @__PURE__ */ React3.createElement($2, null, r3`\expr`), " has type ", /* @__PURE__ */ React3.createElement($2, null, r3`\ty`), " under contexts ", /* @__PURE__ */ React3.createElement($2, null, r3`\fenv, \tyenv, \stackenv`), " producing new context ", /* @__PURE__ */ React3.createElement($2, null, r3`\stackenv'`), '."'), " ", /* @__PURE__ */ React3.createElement($2, null, r3`\tyenv`), " contains function-level type and provenance variables. ", /* @__PURE__ */ React3.createElement($2, null, r3`\stackenv`), " maps variables to types and provenances to pointed-to place expressions with ownership qualifiers. For instance, when type checking ", /* @__PURE__ */ React3.createElement(C, null, "*b := a.1"), " in ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "fig:oxide_syntax_example"
  }), " , the inputs would be ", /* @__PURE__ */ React3.createElement($2, null, r3`\tyenv = \tyenvempty`), " (empty) and ", /* @__PURE__ */ React3.createElement($2, null, r3`\stackenv = \{a \mapsto (\uty, \uty),~ b \mapsto \eref{\uniq}{\r_2}{\uty},~ r_1 \mapsto \{\loanform{\uniq}{a.0}\},~ \r_2 \mapsto \{\loanform{\uniq}{a.0}\}\}`), "."), /* @__PURE__ */ React3.createElement("p", null, "Typechecking relies on a number of auxiliary judgments, such as subtyping (", /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:subtype",
    Tooltip: null
  }, /* @__PURE__ */ React3.createElement($2, null, r3`\subtype{\tyenv}{\stackenv}{\tau_1}{\tau_2}{\stackenv'}`)), ") and ownership-safety (", /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:ownsafe"
  }, /* @__PURE__ */ React3.createElement($2, null, r3`\ownsafe{\tyenv}{\stackenv}{\ownq}{\pexp}{\loanset}`), ', read as "', /* @__PURE__ */ React3.createElement($2, null, r3`\pexp`), " has ", /* @__PURE__ */ React3.createElement($2, null, r3`\ownq\text{-loans}`), " ", /* @__PURE__ */ React3.createElement($2, null, r3`\loanset`), " in the contexts ", /* @__PURE__ */ React3.createElement($2, null, r3`\Delta, \Gamma`), '"'), "). As an example, consider ", /* @__PURE__ */ React3.createElement(Smallcaps, null, "T-Assign"), " ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "weiss2019oxide",
    y: true,
    ex: "p. 11"
  }), " for the assignment expression ", /* @__PURE__ */ React3.createElement($2, null, r3`\exprplcasgn{\plc}{\expr}`), ":"), /* @__PURE__ */ React3.createElement("center", null, /* @__PURE__ */ React3.createElement(AssignStaticRule, null)), /* @__PURE__ */ React3.createElement("p", {
    className: "noindent",
    style: { color: "#444" }
  }, "[Note: Each section of the rule has a natural language explanation, shown by default. Click on the ", /* @__PURE__ */ React3.createElement("span", {
    style: { marginLeft: "-0.5rem" }
  }, /* @__PURE__ */ React3.createElement(ToggleButton2, {
    big: true,
    on: false,
    onClick: () => {
    }
  })), " button to see corresponding mathematical formula. You can also click on the right-most button to toggle all sections at once.]"), /* @__PURE__ */ React3.createElement("p", null, "A valid assignment must be type-safe and ownership-safe. To be type-safe, the type of the expression ", /* @__PURE__ */ React3.createElement($2, null, r3`\tys`), " must be a subtype of the place's type ", /* @__PURE__ */ React3.createElement($2, null, r3`\stackenv_1(\plc)`), ". To be ownership-safe, the type must either be dead", /* @__PURE__ */ React3.createElement(Footnote, null, "Oxide uses the metavariables ", /* @__PURE__ */ React3.createElement($2, null, r3`\tyd`), " to mean ``dead types'' and ", /* @__PURE__ */ React3.createElement($2, null, r3`\tysx`), " to mean ``possibly dead types''. A place becomes dead when it is moved, e.g. see ", /* @__PURE__ */ React3.createElement(Smallcaps, null, "T-Move"), " in ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "weiss2019oxide",
    y: true,
    ex: "p. 11"
  }), ". ", /* @__PURE__ */ React3.createElement(Smallcaps, null, "T-Assign"), " allows a dead place to be revived. For instance, consider the program:", /* @__PURE__ */ React3.createElement($$2, null, r3`\exprlet{\vr}{\sty}{"a"}{\exprseq{\msf{print}(\vr)}{\exprplcasgn{\vr}{"b"}}}`), "When ", /* @__PURE__ */ React3.createElement($2, null, r3`\msf{print}(\vr)`), " moves ", /* @__PURE__ */ React3.createElement($2, null, r3`\vr`), ", its type is updated to ", /* @__PURE__ */ React3.createElement($2, null, r3`\tyds{\sty}`), " in ", /* @__PURE__ */ React3.createElement($2, null, r3`\stackenv`), ". Then the ", /* @__PURE__ */ React3.createElement(Smallcaps, null, "T-Assign"), " rule permits ", /* @__PURE__ */ React3.createElement($2, null, r3`\vr`), " to be assigned again to ``revive'' that place, setting its type back to ", /* @__PURE__ */ React3.createElement($2, null, r3`\sty`), "."), ", or ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc`), " must have unique ownership over itself, i.e. there should be no live references to ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc`), ". If so, then the type of ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc`), " is updated to ", /* @__PURE__ */ React3.createElement($2, null, r3`\tys`), ".")), /* @__PURE__ */ React3.createElement(SubSection, {
    name: "sec:dynsem",
    title: "Dynamic semantics"
  }, /* @__PURE__ */ React3.createElement("p", null, "Expressions are executed via a small-step operational semantics, and the program state is a pair of a stack and an expression. ", /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:stepsto"
  }, "A single step is represented by the judgment ", /* @__PURE__ */ React3.createElement($2, null, r3`\stepsto{\fenv}{\stack}{\expr}{\stepped{\stack}}{\expr'}`), "."), " ", /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:stack"
  }, "A stack ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack`), " is a list of stack frames ", /* @__PURE__ */ React3.createElement($2, null, r3`\varsigma ::= \setof{\vr \mapsto v}`), " that map variables to values."), " For example, consider ", /* @__PURE__ */ React3.createElement(Smallcaps, null, "E-Assign"), " ", /* @__PURE__ */ React3.createElement(Cite, {
    v: "weiss2019oxide",
    y: true,
    ex: "p. 16"
  }), " that covers ", /* @__PURE__ */ React3.createElement($2, null, r3`\exprplcasgn{\plc}{\expr}`), " and ", /* @__PURE__ */ React3.createElement($2, null, r3`\exprpexpasgn{\pexp}{\expr}`), " expressions:", /* @__PURE__ */ React3.createElement(Footnote, null, "This ", /* @__PURE__ */ React3.createElement(Smallcaps, null, "E-Assign"), " rule is not the exact same rule that appears in ", /* @__PURE__ */ React3.createElement(Cite, {
    f: true,
    v: "weiss2019oxide",
    ex: "p. 16"
  }), " , as the published version is incorrect. In correspondence with the authors, we determined that the rule presented here has the intended semantics. Additionally, we do not use the referent ", /* @__PURE__ */ React3.createElement($2, null, r3`\mathcal{R}`), " construct of Oxide since we do not consider arrays in this paper, so we use ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc`), " anywhere ", /* @__PURE__ */ React3.createElement($2, null, r3`\mathcal{R}`), " would otherwise appear.")), /* @__PURE__ */ React3.createElement("center", null, /* @__PURE__ */ React3.createElement(AssignDynamicRule, null)), /* @__PURE__ */ React3.createElement("p", null, "This rule introduces several new shorthands and administrative forms:"), /* @__PURE__ */ React3.createElement("ul", null, /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:pctx"
  }, "The syntax ", /* @__PURE__ */ React3.createElement($2, null, r3`\pctx{\plc}{\vr}`), " means the decomposition of a place ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc`), " into a root variable ", /* @__PURE__ */ React3.createElement($2, null, r3`\vr`), " and context ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc^\square`), "."), " For example, if ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc = a.0`), " then ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc^\square = \square.0`), " and ", /* @__PURE__ */ React3.createElement($2, null, r3`x = a`), " ."), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:valuectx"
  }, "A value context ", /* @__PURE__ */ React3.createElement($2, null, r3`\valuectx`), " is a form to handle mutation of compound objects."), " For instance, if ", /* @__PURE__ */ React3.createElement($2, null, r3`a = (0, 1)`), " , when evaluating ", /* @__PURE__ */ React3.createElement($2, null, r3`\exprplcasgn{a.0}{2}`), " , then ", /* @__PURE__ */ React3.createElement($2, null, r3`\valuectx = (\square, 1)`), ". ", /* @__PURE__ */ React3.createElement($2, null, r3`\valuectx`), " copies all the old values, leaving a hole for the one value to be updated. Then the syntax ", /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:valueplug"
  }, /* @__PURE__ */ React3.createElement($2, null, r3`\valueplug{\valuectx}{v}`), " means plugging ", /* @__PURE__ */ React3.createElement($2, null, r3`v`), " into the hole."), " Hence, mutating a place is represented as ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack[x \mapsto \valueplug{\valuectx}{v}]`), "."), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:pointsto"
  }, "The judgment ", /* @__PURE__ */ React3.createElement($2, null, r3`\pointsto{\stack}{\pexp}{\pctx{\plc}{\vr}}{\valuectx}`), " evaluates a place expression ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp`), " under the current stack ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack`), " into a place ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc`), " and value context ", /* @__PURE__ */ React3.createElement($2, null, r3`\valuectx`), "."), " For instance, if ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp`), " is a dereference of a reference, then this judgment resolves ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp`), " to the concrete memory location ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc`), " it points-to under ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack`), "."))), /* @__PURE__ */ React3.createElement(SubSection, {
    name: "sec:formal_principles",
    title: "Formalized principles"
  }, /* @__PURE__ */ React3.createElement("p", null, "Now, we have enough of the language formalized to give a precise statement of each slicing principle from ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:background"
  }), ". Each principle will be presented with the corresponding theorem, using underlining in color to highlight correspondences."), /* @__PURE__ */ React3.createElement("p", null, "In the principles and corresponding algorithm/proofs, there are many concepts which we  distinguish by notational convention. We denote objects by their metavariable, e.g. ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp`), " or ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack`), ", and add a sans-serif subscript for distinct roles where needed, e.g. ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc_\mut`), " for a mutated place and ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc_\any`), " for an arbitrary place. We generally use a superscript ", /* @__PURE__ */ React3.createElement($2, null, r3`i`), " for an object that varies between two executions of a program, like ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack^i`), " or ", /* @__PURE__ */ React3.createElement($2, null, r3`v^i`), " . And we use right arrows to indicate changes to an object after stepping (instead of primes, to avoid polluting the superscript), e.g. ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack^i`), " versus ", /* @__PURE__ */ React3.createElement($2, null, r3`\stepped{\stack}^i`), "."), /* @__PURE__ */ React3.createElement("hr", null), /* @__PURE__ */ React3.createElement(Correspondence, null, /* @__PURE__ */ React3.createElement(Row, null, /* @__PURE__ */ React3.createElement("div", {
    style: { width: "300px", marginRight: "3rem" }
  }, /* @__PURE__ */ React3.createElement(Smallcaps, null, /* @__PURE__ */ React3.createElement(Ref, {
    name: "prin:places"
  })), /* @__PURE__ */ React3.createElement("div", {
    style: { fontStyle: "italic" }
  }, "A ", /* @__PURE__ */ React3.createElement(Link, {
    name: "1"
  }, "mutation"), " to a ", /* @__PURE__ */ React3.createElement(Link, {
    name: "2"
  }, "place"), " is a ", /* @__PURE__ */ React3.createElement(Link, {
    name: "3"
  }, "mutation"), " to ", /* @__PURE__ */ React3.createElement(Link, {
    name: "4"
  }, "all conflicting places."))), /* @__PURE__ */ React3.createElement("div", {
    style: { width: "max-content" }
  }, /* @__PURE__ */ React3.createElement(Theorem, {
    name: "thm:slice-places"
  }, "Let: ", /* @__PURE__ */ React3.createElement("ul", {
    style: { margin: "0" }
  }, /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\link{2}{\plc_\mut = \pctx{\plc_\mut}{\vr}}, \stack`), " where ", /* @__PURE__ */ React3.createElement($2, null, r3`\pointsto{\stack}{\plc_\mut}{\_}{\valuectx}`)), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`v, \link{1}{\stepped{\stack} =\stack[\vr \mapsto \valueplug{\valuectx}{v}]}`)), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement(Link, {
    name: "4"
  }, /* @__PURE__ */ React3.createElement($2, null, r3`\plc_\any`), " be any place"))), "Then ", /* @__PURE__ */ React3.createElement($2, null, r3`\link{3}{\stack(\plc_\any) \neq \stepped{\stack}(\plc_\any)} \implies \link{4}{\notdisjoint{\plc_\any}{\plc_\mut}}`), ".")))), /* @__PURE__ */ React3.createElement("p", null, "As described in ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:dynsem"
  }), ", a mutation to a place is represented by updating a variable ", /* @__PURE__ */ React3.createElement($2, null, r3`\vr`), " in a stack ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack`), " by plugging a value ", /* @__PURE__ */ React3.createElement($2, null, r3`v`), " into a value context ", /* @__PURE__ */ React3.createElement($2, null, r3`\valuectx`), ". To denote a conflict,we reuse the notation from Oxide that ", /* @__PURE__ */ React3.createElement($2, null, r3`\disjoint{\plc_1}{\plc_2}`), ' means " ', /* @__PURE__ */ React3.createElement($2, null, r3`\plc_1`), " and ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc_2`), ' do not conflict", or more formally:'), /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:disjoint"
  }, /* @__PURE__ */ React3.createElement($$2, null, r3`\disjoint{x_1.q_1}{x_2.q_2} \eqdef x_1 \neq x_2 \vee ((q_1 \text{ is not a prefix of } q_2) \wedge (q_2 \text{ is not a prefix of } q_1))`)), /* @__PURE__ */ React3.createElement("p", {
    className: "noindent"
  }, "Conversely, we use the shorthand ", /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:notdisjoint"
  }, /* @__PURE__ */ React3.createElement($2, null, r3`\notdisjoint{\pi_1}{\pi_2} \eqdef \neg(\disjoint{\pi_1}{\pi_2})`)), ". So if a place ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc_\any`), " is changed when ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc_\mut`), " is mutated, then it must be that ", /* @__PURE__ */ React3.createElement($2, null, r3`\notdisjoint{\plc_\any}{\plc_\mut}`), "."), /* @__PURE__ */ React3.createElement("hr", null), /* @__PURE__ */ React3.createElement(Correspondence, null, /* @__PURE__ */ React3.createElement(Row, null, /* @__PURE__ */ React3.createElement("div", {
    style: { width: "400px", marginRight: "3rem" }
  }, /* @__PURE__ */ React3.createElement(Smallcaps, null, /* @__PURE__ */ React3.createElement(Ref, {
    name: "prin:references"
  })), /* @__PURE__ */ React3.createElement("br", null), /* @__PURE__ */ React3.createElement("em", null, "The ", /* @__PURE__ */ React3.createElement(Link, {
    name: "1"
  }, "lifetime"), " of a ", /* @__PURE__ */ React3.createElement(Link, {
    name: "2"
  }, "reference"), " contains all potential ", /* @__PURE__ */ React3.createElement(Link, {
    name: "3"
  }, "aliases"), " of what the reference ", /* @__PURE__ */ React3.createElement(Link, {
    name: "4"
  }, "points-to."))), /* @__PURE__ */ React3.createElement("div", {
    style: { width: "max-content", textAlign: "left" }
  }, /* @__PURE__ */ React3.createElement(Theorem, {
    name: "thm:slice-refs"
  }, "Let: ", /* @__PURE__ */ React3.createElement("ul", {
    style: { margin: "0" }
  }, /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\stack`), " where ", /* @__PURE__ */ React3.createElement($2, null, r3`\fenv \vdash \stack : \stackenv`)), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\link{2}{\pexp_\mut}`), " where ", /* @__PURE__ */ React3.createElement($2, null, r3`\link{1}{\ownsafe{\tyenvempty}{\stackenv}{\uniq}{\pexp_\mut}{\loanset}}`), " and ", /* @__PURE__ */ React3.createElement($2, null, r3`\pointsto{\stack}{\pexp_\mut}{\link{4}{\plc_\mut}}{\_}`)), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\link{3}{\pexp_\any}`), " where ", /* @__PURE__ */ React3.createElement($2, null, r3`\pointsto{\stack}{\pexp_\any}{\plc_\any}{\_}`))), "Then ", /* @__PURE__ */ React3.createElement($2, null, r3`\notdisjoint{\plc_\any}{\plc_\mut} \implies \link{3}{\exists \loanform{\uniq}{\pexp_\msf{loan}}} ~ . ~ \notdisjoint{\pexp_\any}{\pexp_\msf{loan}}`), ".")))), /* @__PURE__ */ React3.createElement("p", null, "Rather than referring to a lifetime directly, we instead use Oxide's ownership safety judgment described in ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "sec:statsem"
  }), " to get the corresponding loan set for a mutated place expression ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp_\mut`), ". If ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp_\mut`), " includes a dereference, then the loan set should include potential aliases."), /* @__PURE__ */ React3.createElement("p", null, "A notable detail is that we do not compare the loan sets of ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp_\mut`), " and ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp_\any`), " to see if they contain conflicting places, but rather compare ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp_\any`), " just against the loan set of ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp_\mut`), ". This works because the loan set contains not just the set of places ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc`), " that ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp_\mut`), " could point-to, but also the set of other references to the places ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp_\mut`), " points-to (via reborrows)."), /* @__PURE__ */ React3.createElement("hr", null), /* @__PURE__ */ React3.createElement(Correspondence, null, /* @__PURE__ */ React3.createElement(Row, null, /* @__PURE__ */ React3.createElement("div", {
    style: { width: "340px", marginRight: "2.5rem", textAlign: "left" }
  }, /* @__PURE__ */ React3.createElement(Smallcaps, null, /* @__PURE__ */ React3.createElement(Ref, {
    name: "prin:function calls"
  })), /* @__PURE__ */ React3.createElement("br", null), /* @__PURE__ */ React3.createElement("div", {
    style: { fontStyle: "italic" }
  }, "When ", /* @__PURE__ */ React3.createElement(Link, {
    name: "1"
  }, "calling a function:"), /* @__PURE__ */ React3.createElement("ol", {
    className: "parenkey"
  }, /* @__PURE__ */ React3.createElement("li", null, "only ", /* @__PURE__ */ React3.createElement(Link, {
    name: "2"
  }, "mutable references in the arguments"), " ", /* @__PURE__ */ React3.createElement(Link, {
    name: "3"
  }, "can be mutated"), ", and...")))), /* @__PURE__ */ React3.createElement("div", {
    style: { width: "max-content", textAlign: "left" }
  }, /* @__PURE__ */ React3.createElement(Theorem, {
    name: "thm:proc_mutrefs"
  }, "Let: ", /* @__PURE__ */ React3.createElement("ul", {
    style: { margin: "0" }
  }, /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\stackenv, \plc_\arrg, \stack`), " where ", /* @__PURE__ */ React3.createElement($2, null, r3`\stackenv(\plc_\arrg) = \tys`), " and ", /* @__PURE__ */ React3.createElement($2, null, r3`\fenv \vdash \stack : \stackenv`)), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\fname`), " where ", /* @__PURE__ */ React3.createElement($2, null, r3`\link{1}{\evalsto{\fenv}{\stack}{\fname(\plc_\arrg)}{\stepped{\stack}}{\_}}`)), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\stepped{\stack}' = \stepped{\stack}[\link{2}{\forall \pexp_\reff \in \refs{\uniq}{\plc_\arrg, \tys}} ~ . ~ \link{3}{\pexp_\reff \mapsto \stack(\pexp_\reff)}]`))), "Then ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack = \stepped{\stack}'`), ".")))), /* @__PURE__ */ React3.createElement("p", null, "First, ", /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:refs"
  }, 'we define "mutable references in the arguments" as ', /* @__PURE__ */ React3.createElement($2, null, r3`\refs{\ownq}{\pexp, \tys}`), " that returns the ", /* @__PURE__ */ React3.createElement($2, null, r3`\ownq`), "-safe place expressions of references inside of ", /* @__PURE__ */ React3.createElement($2, null, r3`\pexp`), " of type ", /* @__PURE__ */ React3.createElement($2, null, r3`\tys`)), ". For instance, if ", /* @__PURE__ */ React3.createElement($2, null, r3`x = 0`), " and ", /* @__PURE__ */ React3.createElement($2, null, r3`y = (0, \tysref{\uniq}{\concrprov}{x})`), " then ", /* @__PURE__ */ React3.createElement($2, null, r3`\refs{\uniq}{y, (\uty, \tysref{\uniq}{\concrprov}{\uty})} = \{\pexpderef{y.1}\}`), " . The full definition is:"), /* @__PURE__ */ React3.createElement($$2, null, r3`
        \begin{align*}
          \refs{\ownq}{\pexp, \tyb} &=
              \varnothing
          \hspace{32pt}
          \refs{\ownq}{\pexp, \tystup{\tys_1, \ldots, \tys_n}} = 
              \bigcup_i \refs{\ownq}{\pexp.i, \tys_i}
          \\ 
          \refs{\ownq}{p, \tysref{\ownq'}{\prov}{\tyx}} &= \begin{cases}
            \{\pexpderef{\pexp}\} \cup \refs{\ownq}{\pexpderef{p}, \tyx} & \text{if $\ownqleq{\ownq'}{\ownq}$} \\
            \varnothing & \text{otherwise}
          \end{cases}
        \end{align*}
        `), /* @__PURE__ */ React3.createElement("p", {
    className: "noindent"
  }, "Here, ", /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:ownqleq"
  }, "the relation ", /* @__PURE__ */ React3.createElement($2, null, r3`\ownqleq{\ownq'}{\ownq}`), " is defined as ", /* @__PURE__ */ React3.createElement($2, null, r3`\uniq \not\lesssim \shrd`), " and otherwise ", /* @__PURE__ */ React3.createElement($2, null, r3`\ownqleq{\ownq'}{\ownq}`), ".")), /* @__PURE__ */ React3.createElement("p", null, "Then we define ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "thm:proc_mutrefs"
  }), " in the theme of a transaction: if all the changes to unique references in ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc_\arrg`), " are rolled back, then the new stack is the same as the one before the function call. This means implicitly that no other values could have been mutated."), /* @__PURE__ */ React3.createElement("hr", null), /* @__PURE__ */ React3.createElement(Correspondence, null, /* @__PURE__ */ React3.createElement(Row, null, /* @__PURE__ */ React3.createElement("div", {
    style: { width: "330px", marginRight: "2rem", textAlign: "left" }
  }, /* @__PURE__ */ React3.createElement(Smallcaps, null, /* @__PURE__ */ React3.createElement(Ref, {
    name: "prin:function calls"
  })), /* @__PURE__ */ React3.createElement("br", null), /* @__PURE__ */ React3.createElement("div", {
    style: { fontStyle: "italic" }
  }, "When ", /* @__PURE__ */ React3.createElement(Link, {
    name: "1"
  }, "calling a function:"), /* @__PURE__ */ React3.createElement("ol", {
    className: "parenkey",
    start: 2
  }, /* @__PURE__ */ React3.createElement("li", null, "...the ", /* @__PURE__ */ React3.createElement(Link, {
    name: "2"
  }, "mutations"), " and ", /* @__PURE__ */ React3.createElement(Link, {
    name: "3"
  }, "return value"), " are only ", /* @__PURE__ */ React3.createElement(Link, {
    name: "4"
  }, "influenced by the arguments."))))), /* @__PURE__ */ React3.createElement("div", {
    style: { width: "max-content", textAlign: "left" }
  }, /* @__PURE__ */ React3.createElement(Theorem, {
    name: "thm:proc_eqarg"
  }, "Let: ", /* @__PURE__ */ React3.createElement("ul", {
    style: { margin: "0" }
  }, /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\stackenv, \plc_\arrg, \stack^i`), " where ", /* @__PURE__ */ React3.createElement($2, null, r3`\stackenv(\plc_\arrg) = \tys`), " and ", /* @__PURE__ */ React3.createElement($2, null, r3`i \in \{1, 2\}, \fenv \vdash \stack^i : \stackenv`)), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\fname`), " where ", /* @__PURE__ */ React3.createElement($2, null, r3`\link{1}{\evalsto{\fenv}{\stack}{\fname(\plc_\arrg)}{\stepped{\stack}}{v^i}}`)), /* @__PURE__ */ React3.createElement("li", null, /* @__PURE__ */ React3.createElement($2, null, r3`\link{4}{P = \allplaces{\plc_\arrg}{\tys}}`))), "Then ", /* @__PURE__ */ React3.createElement($2, null, r3`\link{4}{\stackeq{\stack^1}{\stack^2}{P}} \implies \link{2}{\stackeq{\stepped{\stack}^1}{\stepped{\stack}^2}{P}} \wedge \link{3}{v^1 = v^2}`))))), /* @__PURE__ */ React3.createElement("p", null, "The idea behind ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "thm:proc_eqarg"
  }), ' is that "influence" is translated into a form of noninterference: if the input to a function is the same under any two stacks ', /* @__PURE__ */ React3.createElement($2, null, r3`\stack^1`), " and ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack^2`), ", then the mutations to that input must be the same. The rest of the stack is allowed to vary, but because the function ", /* @__PURE__ */ React3.createElement($2, null, r3`\fname`), " cannot read it, that variation cannot influence the final value. "), /* @__PURE__ */ React3.createElement("p", null, 'To formalize "the input being the same", we introduce another auxiliary function for transitive equality. For instance, if we only required that ', /* @__PURE__ */ React3.createElement($2, null, r3`\stack^1(\plc_\arrg) = \stack^2(\plc_\arrg)`), " where ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc_\arrg = \msf{ptr}~x`), ", then if ", /* @__PURE__ */ React3.createElement($2, null, r3`\stack^1(x) \neq \stack^2(x)`), " the theorem would not be true. Hence, transitive equality is defined as equality including all pointed places. We define this concept through two pieces: a function for generating the set of places (denoted by ", /* @__PURE__ */ React3.createElement($2, null, r3`P`), "), and a relation defining the equivalence of stacks for a set of places."), /* @__PURE__ */ React3.createElement($$2, null, r3`
          \begin{align*}
            \cmddef{allplaces}{\allplaces{\pexp}{\tys}} &\eqdef \{\pexp\} \cup \refs{\shrd}{\pexp, \tys} \\
            \cmddef{stackeq}{\stackeq{\stack^1}{\stack^2}{P}} &\eqdef \forall \pexp \in P ~ . ~ \stack^1(\pexp) = \stack^2(\pexp)
          \end{align*}
        `), /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:allplaces",
    Tooltip: () => /* @__PURE__ */ React3.createElement($2, null, r3`\allplaces{\pexp}{\tys} \eqdef \{\pexp\} \cup \refs{\shrd}{\pexp, \tys}`)
  }), /* @__PURE__ */ React3.createElement(Definition, {
    name: "tex:stackeq",
    Tooltip: () => /* @__PURE__ */ React3.createElement($2, null, r3`\stackeq{\stack^1}{\stack^2}{P} \eqdef \forall \pexp \in P ~ . ~ \stack^1(\pexp) = \stack^2(\pexp)`)
  }), /* @__PURE__ */ React3.createElement("p", null, "Therefore ", /* @__PURE__ */ React3.createElement(Ref, {
    name: "thm:proc_eqarg"
  }), " states that if ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc_\arrg`), " is transitively equal under two otherwise arbitrary stacks, then ", /* @__PURE__ */ React3.createElement($2, null, r3`\plc_\arrg`), " is still transitively equal after evaluating ", /* @__PURE__ */ React3.createElement($2, null, r3`\fname(\plc_\arrg)`), " , and the output of ", /* @__PURE__ */ React3.createElement($2, null, r3`\fname(\plc_\arrg)`), " is also equal."))));
};
export {
  Paper
};
/**
 * @license
 * Lodash <https://lodash.com/>
 * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */
//# sourceMappingURL=paper.js.map
