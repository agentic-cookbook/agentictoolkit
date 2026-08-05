'use client'

"use client";

// src/header/HeaderCenter.tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import { jsx } from "react/jsx-runtime";
var NOOP = () => {
};
var HeaderCenterContext = createContext({
  el: null,
  register: NOOP,
  provided: false
});
function HeaderCenterProvider({ children }) {
  const [el, setEl] = useState(null);
  const register = useCallback((next) => setEl(next), []);
  const value = useMemo(() => ({ el, register, provided: true }), [el, register]);
  return /* @__PURE__ */ jsx(HeaderCenterContext.Provider, { value, children });
}
function useHeaderCenter() {
  return useContext(HeaderCenterContext).el;
}
function useHeaderCenterRegister() {
  return useContext(HeaderCenterContext).register;
}
function useHeaderCenterProvided() {
  return useContext(HeaderCenterContext).provided;
}
export {
  HeaderCenterProvider,
  useHeaderCenter,
  useHeaderCenterProvided,
  useHeaderCenterRegister
};
//# sourceMappingURL=HeaderCenter.js.map