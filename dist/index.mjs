var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, {enumerable: true, configurable: true, writable: true, value}) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// src/index.ts
import {resolve as resolve2} from "path";

// src/files.ts
import fg from "fast-glob";

// src/utils.ts
import fs from "fs";
import {resolve, basename} from "path";
import Debug from "debug";

// src/parser.ts
import {parse} from "@vue/compiler-sfc";
import JSON5 from "json5";
import YAML from "yaml";
function parseSFC(code) {
  try {
    return parse(code, {
      pad: "space"
    }).descriptor;
  } catch {
    throw new Error(`[vue-route-generator] Vue3's "@vue/compiler-sfc" is required.`);
  }
}
function parseCustomBlock(block, filePath, options) {
  var _a;
  const lang = (_a = block.lang) != null ? _a : options.routeBlockLang;
  if (lang === "json5") {
    try {
      return JSON5.parse(block.content);
    } catch (err) {
      throw new Error(`Invalid JSON5 format of <${block.type}> content in ${filePath}
${err.message}`);
    }
  } else if (lang === "json") {
    try {
      return JSON.parse(block.content);
    } catch (err) {
      throw new Error(`Invalid JSON format of <${block.type}> content in ${filePath}
${err.message}`);
    }
  } else if (lang === "yaml") {
    try {
      return YAML.parse(block.content);
    } catch (err) {
      throw new Error(`Invalid YAML format of <${block.type}> content in ${filePath}
${err.message}`);
    }
  }
}

// src/constants.ts
var MODULE_IDS = ["pages-generated", "virtual:generated-pages"];
var MODULE_ID_VIRTUAL = "/@vite-plugin-pages/generated-pages";

// src/utils.ts
function extensionsToGlob(extensions) {
  return extensions.length > 1 ? `{${extensions.join(",")}}` : extensions[0] || "";
}
function isPagesDir(path, options) {
  for (const page of options.pagesDirOptions) {
    const dirPath = slash(resolve(options.root, page.dir));
    if (path.startsWith(dirPath))
      return true;
  }
  return false;
}
function isTarget(path, options) {
  return isPagesDir(path, options) && options.extensionsRE.test(path);
}
function slash(str) {
  return str.replace(/\\/g, "/");
}
var debug = {
  hmr: Debug("vite-plugin-pages:hmr"),
  sfc: Debug("vite-plugin-pages:sfc"),
  gen: Debug("vite-plugin-pages:gen")
};
var dynamicRouteRE = /^\[.+\]$/;
var nuxtDynamicRouteRE = /^_[\s\S]*$/;
function isDynamicRoute(routePath, nuxtStyle = false) {
  return nuxtStyle ? nuxtDynamicRouteRE.test(routePath) : dynamicRouteRE.test(routePath);
}
function isCatchAllRoute(routePath, nuxtStyle = false) {
  return nuxtStyle ? /^_$/.test(routePath) : /^\[\.{3}/.test(routePath);
}
function resolveImportMode(filepath, options) {
  const mode = options.importMode;
  if (typeof mode === "function")
    return mode(filepath);
  if (options.syncIndex && filepath === `/${options.pagesDir}/index.vue`)
    return "sync";
  else
    return mode;
}
function pathToName(filepath) {
  return filepath.replace(/[_.\-\\/]/g, "_").replace(/[[:\]()]/g, "$");
}
function findRouteByFilename(routes, filename) {
  let result = null;
  for (const route of routes) {
    if (filename.endsWith(route.component))
      result = route;
    if (!result && route.children)
      result = findRouteByFilename(route.children, filename);
    if (result)
      return result;
  }
  return null;
}
function getRouteBlock(path, options) {
  const content = fs.readFileSync(path, "utf8");
  const parsed = parseSFC(content);
  const blockStr = parsed.customBlocks.find((b) => b.type === "route");
  if (!blockStr)
    return null;
  const result = parseCustomBlock(blockStr, path, options);
  return result;
}
function getPagesVirtualModule(server) {
  const {moduleGraph} = server;
  const module = moduleGraph.getModuleById(MODULE_ID_VIRTUAL);
  if (module) {
    moduleGraph.invalidateModule(module);
    return module;
  }
  return null;
}
function replaceSquareBrackets(bundle) {
  const files = Object.keys(bundle).map((i) => basename(i));
  for (const chunk of Object.values(bundle)) {
    chunk.fileName = chunk.fileName.replace(/(\[|\])/g, "_");
    if (chunk.type === "chunk") {
      for (const file of files)
        chunk.code = chunk.code.replace(file, file.replace(/(\[|\])/g, "_"));
    }
  }
}

// src/files.ts
function getIgnore(exclude) {
  return ["node_modules", ".git", "**/__*__/**", ...exclude];
}
async function getPageDirs(pageDirOptions, options) {
  const {exclude} = options;
  const dirs = await fg(pageDirOptions.dir, {
    ignore: getIgnore(exclude),
    onlyDirectories: true,
    dot: true,
    unique: true
  });
  const pageDirs = dirs.map((dir) => __spreadProps(__spreadValues({}, pageDirOptions), {
    dir
  }));
  return pageDirs;
}
async function getPageFiles(path, options) {
  const {
    extensions,
    exclude
  } = options;
  const ext = extensionsToGlob(extensions);
  const files = await fg(`**/*.${ext}`, {
    ignore: getIgnore(exclude),
    onlyFiles: true,
    cwd: path
  });
  return files;
}

// src/generate.ts
import {join} from "path";
import deepEqual from "deep-equal";

// src/stringify.ts
function replacer(_, value) {
  if (value instanceof Function || typeof value === "function") {
    const fnBody = value.toString();
    if (fnBody.length < 8 || fnBody.substring(0, 8) !== "function")
      return `_NuFrRa_${fnBody}`;
    return fnBody;
  }
  return value;
}
function stringifyRoutes(preparedRoutes, options) {
  const imports = [];
  const stringRoutes = JSON.stringify(preparedRoutes, replacer, 2).split("\n").map((str) => {
    if (/"component":\s"\S+"/.test(str)) {
      const start = '"component": "';
      const startIndex = str.indexOf(start) + start.length;
      const endIndex = str.endsWith('",') ? str.length - 2 : str.length - 1;
      const path = str.slice(startIndex, endIndex);
      const replaceStr = str.slice(startIndex - 1, endIndex + 1);
      const mode = resolveImportMode(path, options);
      if (mode === "sync") {
        const importName = pathToName(path);
        const importStr = `import ${importName} from '${path}'`;
        if (!imports.includes(importStr))
          imports.push(importStr);
        return str.replace(replaceStr, importName);
      } else {
        return str.replace(replaceStr, `() => import('${path}')`);
      }
    }
    if (/"props":\s"[^"]+"/.test(str)) {
      const start = '"props": "';
      const startIndex = str.indexOf(start) + start.length;
      const endIndex = str.endsWith('",') ? str.length - 2 : str.length - 1;
      const content = str.slice(startIndex, endIndex);
      const replaceStr = str.slice(startIndex - 1, endIndex + 1);
      if (content.startsWith("function"))
        return str.replace(replaceStr, content);
      if (content.startsWith("_NuFrRa_"))
        return str.replace(replaceStr, content.slice(8));
    }
    return str;
  }).join("\n");
  return {
    imports,
    stringRoutes
  };
}

// src/generate.ts
function prepareRoutes(routes, options, pagesDirOptions, parent) {
  var _a;
  for (const route of routes) {
    if (route.name) {
      route.name = route.name.replace(/-index$/, "");
      if (pagesDirOptions.baseRoute)
        route.name = `${pagesDirOptions.baseRoute}-${route.name}`;
    }
    if (parent) {
      route.path = route.path.replace(/^\//, "");
    } else {
      if (pagesDirOptions.baseRoute) {
        const baseRoute = `/${pagesDirOptions.baseRoute}`;
        route.path = route.path === "/" ? baseRoute : baseRoute + route.path;
      }
    }
    if (!options.react)
      route.props = true;
    if (options.react) {
      delete route.name;
      route.routes = route.children;
      delete route.children;
      route.exact = true;
    }
    if (route.children) {
      delete route.name;
      route.children = prepareRoutes(route.children, options, pagesDirOptions, route);
    }
    const filePath = slash(join(options.root, route.component));
    const routeBlock = getRouteBlock(filePath, options);
    Object.assign(route, routeBlock || {});
    Object.assign(route, ((_a = options.extendRoute) == null ? void 0 : _a.call(options, route, parent)) || {});
  }
  return routes;
}
function generateRoutes(filesPath, pagesDirOptions, options) {
  const {dir: pagesDir} = pagesDirOptions;
  const {
    nuxtStyle,
    extensionsRE
  } = options;
  const routes = [];
  for (const filePath of filesPath) {
    const resolvedPath = filePath.replace(extensionsRE, "");
    const pathNodes = resolvedPath.split("/");
    const component = `/${pagesDir}/${filePath}`;
    const route = {
      name: "",
      path: "",
      component
    };
    let parentRoutes = routes;
    for (let i = 0; i < pathNodes.length; i++) {
      const node = pathNodes[i];
      const isDynamic = isDynamicRoute(node, nuxtStyle);
      const isCatchAll = isCatchAllRoute(node, nuxtStyle);
      const normalizedName = isDynamic ? nuxtStyle ? isCatchAll ? "all" : node.replace(/^_/, "") : node.replace(/^\[(\.{3})?/, "").replace(/\]$/, "") : node;
      const normalizedPath = normalizedName.toLowerCase();
      route.name += route.name ? `-${normalizedName}` : normalizedName;
      const parent = parentRoutes.find((node2) => node2.name === route.name);
      if (parent) {
        parent.children = parent.children || [];
        parentRoutes = parent.children;
        route.path = "";
      } else if (normalizedName === "index" && !route.path) {
        route.path += "/";
      } else if (normalizedName !== "index") {
        if (isDynamic) {
          route.path += `/:${normalizedName}`;
          if (isCatchAll)
            route.path += "(.*)";
        } else {
          route.path += `/${normalizedPath}`;
        }
      }
    }
    parentRoutes.push(route);
  }
  const preparedRoutes = prepareRoutes(routes, options, pagesDirOptions);
  return preparedRoutes;
}
function generateClientCode(routes, options) {
  const {imports, stringRoutes} = stringifyRoutes(routes, options);
  return `${imports.join("\n")}

const routes = ${stringRoutes}

export default routes`;
}
function isRouteBlockChanged(filePath, routes, options) {
  const routeBlock = getRouteBlock(filePath, options);
  if (routeBlock) {
    const route = findRouteByFilename(routes, filePath);
    if (route) {
      const before = Object.assign({}, route);
      debug.sfc("route: %O", routeBlock);
      Object.assign(route, routeBlock);
      return !deepEqual(before, route);
    }
  }
  return false;
}

// src/query.ts
import qs from "querystring";
function parseVueRequest(id) {
  const [filename, rawQuery] = id.split("?", 2);
  const query = qs.parse(rawQuery);
  const langPart = Object.keys(query).find((key) => /lang\./i.test(key));
  if (query.vue != null)
    query.vue = true;
  if (query.src != null)
    query.src = true;
  if (query.index != null)
    query.index = Number(query.index);
  if (langPart) {
    const [, lang] = langPart.split(".");
    query.lang = lang;
  }
  return {
    filename,
    query
  };
}

// src/options.ts
function resolveOptions(userOptions) {
  const {
    pagesDir = ["src/pages"],
    extensions = ["vue", "js"],
    routeBlockLang = "json5",
    exclude = [],
    syncIndex = true,
    replaceSquareBrackets: replaceSquareBrackets2 = false,
    nuxtStyle = false,
    react = false
  } = userOptions;
  const importMode = react ? "sync" : "async";
  const root = process.cwd();
  let pagesDirOptions = [];
  if (typeof pagesDir === "string") {
    pagesDirOptions = pagesDirOptions.concat({dir: pagesDir, baseRoute: ""});
  } else {
    for (const dir of pagesDir) {
      if (typeof dir === "string")
        pagesDirOptions = pagesDirOptions.concat({dir, baseRoute: ""});
      else if (dir)
        pagesDirOptions = pagesDirOptions.concat(dir);
    }
  }
  const extensionsRE = new RegExp(`\\.(${extensions.join("|")})$`);
  return Object.assign({}, {
    routeBlockLang,
    root,
    pagesDir,
    pagesDirOptions,
    extensions,
    importMode,
    exclude,
    syncIndex,
    replaceSquareBrackets: replaceSquareBrackets2,
    nuxtStyle,
    react,
    extensionsRE
  }, userOptions);
}

// src/index.ts
function pagesPlugin(userOptions = {}) {
  let generatedRoutes = null;
  const options = resolveOptions(userOptions);
  return {
    name: "vite-plugin-pages",
    enforce: "pre",
    async configResolved({root}) {
      options.root = root;
      let pageDirOptions = [];
      for (const pageDirGlob of options.pagesDirOptions) {
        pageDirOptions = [
          ...pageDirOptions,
          ...await getPageDirs(pageDirGlob, options)
        ];
      }
      options.pagesDirOptions = pageDirOptions;
    },
    configureServer(server) {
      const {ws, watcher} = server;
      function fullReload() {
        getPagesVirtualModule(server);
        ws.send({
          type: "full-reload"
        });
      }
      watcher.on("add", (file) => {
        const path = slash(file);
        if (isTarget(path, options)) {
          debug.hmr("add", path);
          generatedRoutes = null;
          fullReload();
        }
      });
      watcher.on("unlink", (file) => {
        const path = slash(file);
        if (isTarget(path, options)) {
          debug.hmr("remove", path);
          generatedRoutes = null;
          fullReload();
        }
      });
      watcher.on("change", (file) => {
        const path = slash(file);
        if (isTarget(path, options) && generatedRoutes) {
          const needReload = isRouteBlockChanged(path, generatedRoutes, options);
          if (needReload) {
            debug.hmr("change", path);
            generatedRoutes = null;
            fullReload();
          }
        }
      });
    },
    resolveId(id) {
      return MODULE_IDS.includes(id) || MODULE_IDS.some((i) => id.startsWith(i)) ? MODULE_ID_VIRTUAL : null;
    },
    async load(id) {
      var _a, _b;
      if (id !== MODULE_ID_VIRTUAL)
        return;
      if (!generatedRoutes) {
        generatedRoutes = [];
        for (const pageDir of options.pagesDirOptions) {
          const pageDirPath = slash(resolve2(options.root, pageDir.dir));
          debug.gen("dir: %O", pageDirPath);
          const files = await getPageFiles(pageDirPath, options);
          debug.gen("files: %O", files);
          const routes = generateRoutes(files, pageDir, options);
          generatedRoutes.push(...routes);
        }
        generatedRoutes = generatedRoutes.sort((i) => isDynamicRoute(i.path) ? 1 : -1);
        const allRoute = generatedRoutes.find((i) => isCatchAllRoute(i.path));
        if (allRoute) {
          generatedRoutes = generatedRoutes.filter((i) => isCatchAllRoute(i.path));
          generatedRoutes.push(allRoute);
        }
        generatedRoutes = await ((_a = options.onRoutesGenerated) == null ? void 0 : _a.call(options, generatedRoutes)) || generatedRoutes;
      }
      debug.gen("routes: %O", generatedRoutes);
      let clientCode = generateClientCode(generatedRoutes, options);
      clientCode = await ((_b = options.onClientGenerated) == null ? void 0 : _b.call(options, clientCode)) || clientCode;
      return clientCode;
    },
    async transform(_code, id) {
      const {query} = parseVueRequest(id);
      if (query && query.vue && query.type === "route") {
        return {
          code: "export default {}",
          map: null
        };
      }
    },
    generateBundle(_options, bundle) {
      if (options.replaceSquareBrackets)
        replaceSquareBrackets(bundle);
    }
  };
}
var src_default = pagesPlugin;
export {
  src_default as default,
  generateRoutes
};
