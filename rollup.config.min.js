// rollup.config.js
import 'rollup'; /* eslint no-unused-vars: 0*/
import resolve from '@rollup/plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import builtins from 'rollup-plugin-node-builtins';

export default {
	output: {
	  format: 'esm',
	  name: 'XRAvatar'
    },
	plugins: [
		resolve({
			browser: true,
      		extensions: [ '.js', '.mjs' ],  // Default: ['.js']
		}),
		builtins(),
		commonjs({
			include: 'node_modules/**',
			namedExports: {
				'node_modules/lzma/src/lzma-d-min.js': [ 'decompress' ]
			}
		}),
        terser() // Code minification
	]
};
