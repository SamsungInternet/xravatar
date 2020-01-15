/*
Tweak the map to use the map as an index rather than as an image

r in image is expressed between 0-1
instead of 0-255

Index = floor(255 * r/16) ~= floor(r * 16);
Brightness = r%16;

Use this to get the colour in HSL format from the array of 16 colours in the uniforms

put into hsl2rgb to get final colour.
*/

export default /* glsl */`
#ifdef USE_MAP
    float index;
    float bshift;
    vec4 indexColor;
    vec4 texelColor;
    vec4 outColor = vec4(0.0);

    float pixelSize = 1.0/2048.0;

    // Center the point on the middle of the texel
    vec2 offset = mod(vUv, pixelSize) - (0.5 * pixelSize);
    vec2 vUv1 = vUv - offset;

    // Normalise offset
    vec2 dir = offset/abs(offset);
    offset*=(dir/pixelSize) * 1.33333;

    // Interpolate when the sampled point sits between two texels
    float totalMix = 0.0;
    ${[
        ['vUv1', '1.0'], // Sample center texel
        ['vUv1 + vec2(pixelSize * dir.x, 0.0)', 'offset.x'], // Sample one texel right/left
        ['vUv1 + vec2(0.0, pixelSize * dir.y)', 'offset.y'], // Sample one texel up/down
    ].map(([uvOffset, mix]) => `
        totalMix += ${mix};
        texelColor = texture2D( map,  ${uvOffset} );
        index = floor(texelColor.r * 16.0) / 16.0 + xravatar_palettetexelsize * 0.5; // Between 0 and 1
        bshift = smoothstep(0.0, 0.0625, mod(texelColor.r, 0.0625)); // Between 0 and 1.0
        indexColor = texture2D( xravatar_palette, vec2(index, 1.0 - bshift) );
        outColor += indexColor * ${mix};
    `
    ).join('\n\n')}

    diffuseColor *= mapTexelToLinear(outColor/totalMix);
#endif
`