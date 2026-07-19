import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

const dev = process.env.ROLLUP_WATCH === "true";

export default {
  input: "src/ha-things.ts",
  output: {
    file: "dist/ha-things.js",
    format: "es",
    sourcemap: dev,
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    !dev && terser(),
  ],
  watch: {
    clearScreen: false,
  },
};
