/*
Tweak the map to use the map as an index rather than as an image

r in image is expressed between 0-1
instead of 0-255

Index = floor(255 * r/16) ~= floor(r * 16);
Brightness = r%16;

Use this to get the colour in HSL format from the array of 16 colours in the uniforms

put into hsl2rgb to get final colour.
*/

export default shader => /* glsl */`
#ifdef USE_MAP
    vec4 texelColor = texture2D( map, vUv );
    texelColor = mapTexelToLinear( texelColor );
    int index = int(16.0 * texelColor.r);
    float bshift = 0.5 * 16.0 * (mod(texelColor.r, 0.0625) - 0.03125);
    vec3 hsl;
    ${
        shader.uniforms.xravatar_palette.value.map((o,i) => `if ( ${i} <= index ) hsl = xravatar_palette[ ${i} ];`).join('\n')
    }
    vec3 rgb = hsl2rgb(hsl.x/360.0, hsl.y, hsl.z + bshift);
    diffuseColor *= vec4(rgb,1.0);
#endif
`