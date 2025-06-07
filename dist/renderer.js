"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
const client_1 = __importDefault(require("react-dom/client")); // Using React 18 createRoot
const App_1 = __importDefault(require("./src/App")); // Adjust path if App.tsx is elsewhere
const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount React app");
}
const root = client_1.default.createRoot(rootElement);
root.render((0, jsx_runtime_1.jsx)(react_1.default.StrictMode, { children: (0, jsx_runtime_1.jsx)(App_1.default, {}) }));
// Log to confirm renderer is loaded
console.log('renderer.tsx loaded and React app initiated.');
//# sourceMappingURL=renderer.js.map