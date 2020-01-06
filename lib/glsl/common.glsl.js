export default () => /* glsl */`
uniform vec3 xravatar_palette[16];

#include <common>

// From https://github.com/Jam3/glsl-hsl2rgb/blob/master/index.glsl
// MIT License (MIT) Copyright (c) 2015 Jam3

float xravatar_hue2rgb(float f1, float f2, float hue) {
    if (hue < 0.0)
        hue += 1.0;
    else if (hue > 1.0)
        hue -= 1.0;
    float res;
    if ((6.0 * hue) < 1.0)
        res = f1 + (f2 - f1) * 6.0 * hue;
    else if ((2.0 * hue) < 1.0)
        res = f2;
    else if ((3.0 * hue) < 2.0)
        res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
    else
        res = f1;
    return res;
}

vec4 xravatar_hsla2rgba(vec4 hsl) {
    vec4 rgb;
    
    if (hsl.y == 0.0) {
        rgb = vec4(hsl.z); // Luminance
    } else {
        float f2;
        
        if (hsl.z < 0.5)
            f2 = hsl.z * (1.0 + hsl.y);
        else
            f2 = hsl.z + hsl.y - hsl.y * hsl.z;
            
        float f1 = 2.0 * hsl.z - f2;
        
        rgb.r = xravatar_hue2rgb(f1, f2, hsl.x + (1.0/3.0));
        rgb.g = xravatar_hue2rgb(f1, f2, hsl.x);
        rgb.b = xravatar_hue2rgb(f1, f2, hsl.x - (1.0/3.0));
    }   
    rgb.a = hsl.a;
    return rgb;
}
`