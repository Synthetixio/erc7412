"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EIP7412 = void 0;
var viem_1 = require("viem");
var node_fetch_1 = require("node-fetch");
var IERC7412_json_1 = require("../out/IERC7412.sol/IERC7412.json");
var EIP7412 = /** @class */ (function () {
    function EIP7412(providers, multicallFunc) {
        this.providers = providers;
        this.multicallFunc = multicallFunc;
    }
    EIP7412.prototype.wrap = function (client, tx) {
        return __awaiter(this, void 0, void 0, function () {
            var multicallCalls, multicallTxn, error_1, err, signedRequiredData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        multicallCalls = [tx];
                        _a.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 9];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 8]);
                        multicallTxn = this.multicallFunc(multicallCalls);
                        return [4 /*yield*/, client.call(multicallTxn)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, multicallTxn];
                    case 4:
                        error_1 = _a.sent();
                        console.log("GOT ERROR DETAILS", error_1);
                        err = viem_1.default.decodeErrorResult({
                            abi: IERC7412_json_1.default.abi,
                            data: error_1.details,
                        });
                        if (!(err.errorName === "OracleDataRequired")) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.fetchOffchainData(client, err.args[0], err.args[1])];
                    case 5:
                        signedRequiredData = _a.sent();
                        multicallCalls.unshift({
                            to: err.args[0],
                            data: signedRequiredData,
                        });
                        return [3 /*break*/, 7];
                    case 6: throw error_1;
                    case 7: return [3 /*break*/, 8];
                    case 8: return [3 /*break*/, 1];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    EIP7412.prototype.fetchOffchainData = function (client, requester, data) {
        return __awaiter(this, void 0, void 0, function () {
            var oracleProvider, _a, _b, url;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _b = (_a = viem_1.default).hexToString;
                        return [4 /*yield*/, client.readContract({
                                abi: IERC7412_json_1.default.abi,
                                address: requester,
                                functionName: "oracleId",
                                args: [],
                            })];
                    case 1:
                        oracleProvider = _b.apply(_a, [(_c.sent())]);
                        url = this.providers.get(oracleProvider);
                        if (url === undefined) {
                            throw new Error("oracle provider not supported");
                        }
                        return [2 /*return*/, this.fetch(url, data)];
                }
            });
        });
    };
    EIP7412.prototype.fetch = function (url, data) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, node_fetch_1.default)(url, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Content-Length": data.length.toString(),
                            },
                            body: data,
                        })];
                    case 1:
                        response = _a.sent();
                        if (response.status !== 200) {
                            throw new Error("error fetching data");
                        }
                        return [4 /*yield*/, response.json()];
                    case 2: return [2 /*return*/, (_a.sent()).result];
                }
            });
        });
    };
    return EIP7412;
}());
exports.EIP7412 = EIP7412;
