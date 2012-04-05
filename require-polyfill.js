// Polyfill for node.js
//  - adds require.ensure
//  - adds require.context
//  call it like this:
//   require = require("webpack/require-polyfill")(require.valueOf());
// This is only required when you want to use the special require.xxx methods
//  in server-side code which should be so only in rar cases.
module.exports = function(req) {
	if(!req.webpackPolyfill) {
		var oldReq = req;
		req = function(name) {
			if(name.indexOf("!") !== -1) {
				var items = name.split(/!/g);
				var resource = oldReq.resolve(items.pop());
				var resolved = [];
				items.forEach(function(item, index) {
					var relative = false;
					if(item.length > 2 &&
						item[0] === ".") {
						if(item[1] === "/")
							relative = true;
						else if(item.length > 3 &&
							item[1] === "." &&
							item[2] === "/")
							relative = true;
					}
					if(item.length > 3 &&
						item[1] === ":" &&
						item[2] === "\\")
						relative = true;
					var tries = [];
					if(!relative) {
						postfixes.forEach(function(postfix) {
							if(item.indexOf("/") !== -1)
								tries.push(item.replace("/", postfix+"/"));
							else
								tries.push(item + postfix);
						});
					}
					tries.push(item);
					for(var i = 0; i < tries.length; i++) {
						for(var ext = 0; ext < extensions.length; ext++) {
							try {
								var file = oldReq.resolve(tries[i] + extensions[ext]);
							} catch(e) {}
							if(file) {
								resolved.push(file);
								break;
							}
						}
						if(ext !== extensions.length)
							break;
					}
					if(i === tries.length)
						throw new Error("Cannot find loader module '"+item+"'");
				});
				resolved = resolved.reverse();
				var cacheLine = resolved.join("!") + "!" + resource;
				var cacheEntry = oldReq.cache[cacheLine];
				if(cacheEntry)
					return cacheEntry;
				var content = [require("fs").readFileSync(resource, "utf-8")];
				var values;
				function exec(code, filename) {
					var Module = require("module");
					var m = new Module("exec in " + cacheLine, module);
					m._compile(code, filename);
					return m.exports;
				}
				resolved.forEach(function(loader) {
					var set = false, err = null;
					var context = {
						request: cacheLine,
						filenames: [resource],
						exec: exec,
						async: function() { return false; },
						callback: function() {
							set = true;
							content = Array.prototype.slice.apply(arguments);
							err = content.shift();
							values = context.values;
						},
						inputValues: values,
						values: undefined
					};
					var retVal = oldReq(loader).apply(context, content);
					if(set) {
						if(err) throw err;
					} else {
						content = [retVal];
						values = context.values;
					}
				});
				if(values !== undefined)
					return values[0];
				return exec(content[0], cacheLine);
			} else
				return oldReq(name);
		};
		req.__proto__ = oldReq;
		req.webpackPolyfill = true;
	}
	if(!req.ensure) {
		req.ensure = function(array, callback) {
			callback(req);
		};
	}
	if(!req.context) {
		req.context = function(contextName) {
			return function(name) {
				return req(contextName + "/" + name);
			}
		}
	}
	return req;
}
var extensions = [".webpack-loader.js", ".loader.js", ".js", ""];
var postfixes = ["-webpack-loader", "-loader", ""]