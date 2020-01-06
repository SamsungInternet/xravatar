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
    int index;
    float bshift;
    vec3 hsl;
    vec4 texelColor;

    float pixelSize = 1.0/2048.0;
    float offsetX = mod(vUv.x, pixelSize);
    float offsetY = mod(vUv.y, pixelSize);
    vec2 vUv1 = vUv - vec2(offsetX, offsetY) + vec2(pixelSize * 0.5);

    texelColor = texture2D( map, vUv1 );
    index = int(16.0 * texelColor.r);
    bshift = 0.5 * 16.0 * (mod(texelColor.r, 0.0625) - 0.03125);
    ${
        shader.uniforms.xravatar_palette.value.map((o,i) => `if ( ${i} <= index ) hsl = xravatar_palette[ ${i} ];`).join('\n')
    }
    texelColor.x = hsl.x/360.0;
    texelColor.y = hsl.y;
    texelColor.z = hsl.z + bshift;
    texelColor = xravatar_hsla2rgba(texelColor);
    texelColor = mapTexelToLinear(texelColor);

    diffuseColor *= texelColor;
#endif
`