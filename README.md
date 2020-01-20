# xravatar
Avatar Creation/Sharing Site

This will be 100% client side only.

## Deliverables
* Avatar editor which for the user to build an xravatar
* API to expose the xravatar in a JSON or Binary format via postmessage through an iframe
* Pack of assets in glb format
* Sprite Sheet + JSON for image assets
* 3rd party library for turning the xravatar string into a THREEjs model (other implementations to come later)

## gltf format
* The editor is designed using the custom properties on the GLTF model's `extras` property
* You can set these using the `Custom Properties` in Blender.

<table>
<thead>
    <tr>
        <td>Custom Property</td>
        <td>What it Controls</td>
        <td>Default Value</td>
    </tr>
</thead>
<tr>
    <td><b>xravatar_index</b></td>
    <td>Order of the items in the interface</td>
    <td>0</td>
</tr>
<tr>
    <td><b>xravatar_minCount</b></td>
    <td>Minimum number of children allowed</td>
    <td>0</td>
</tr>
<tr>
    <td><b>xravatar_maxCount</b></td>
    <td>Max number of children allowed</td>
    <td>1</td>
</tr>
<tr>
    <td><b>xravatar_canMove</b></td>
    <td>Whether an object can be moved</td>
    <td>0.0</td>
</tr>
<tr>
    <td><b>xravatar_minR</b></td>
    <td>Minimum Radius an object can be placed</td>
    <td>0</td>
</tr>
<tr>
    <td><b>xravatar_maxR</b></td>
    <td>Maximum Radius an object can be placed</td>
    <td>0.7</td>
</tr>
<tr>
    <td><b>xravatar_minScale</b></td>
    <td>Minimum Scale an object can be scaled</td>
    <td>0</td>
</tr>
<tr>
    <td><b>xravatar_maxScale</b></td>
    <td>Maximum Scale an object can be scaled</td>
    <td>0.7</td>
</tr>
<tr>
    <td><b>xravatar_canMirror</b></td>
    <td>Whether an object can be mirrored.</td>
    <td>0</td>
</tr>
<tr>
    <td><b>xravatar_defaultMirror</b></td>
    <td>Whether an object defaults to being mirrored</td>
    <td>1</td>
</tr>
</table>

## Notes

* When exporting a new GLTF remember to check 'Custom Properties' in the exporter.
* If you add new npm dependencies for the client side project add them to the repo using

```
git add -f node_modules/path/to/file.js 
```

This is because `node_modules` is under gitignore and we only want to include the files which we are using on the client

## Attributions

Part of the dummy 3D model is from https://poly.google.com/view/549TcOnfEOC by Wuttidech Tarbsuntea

