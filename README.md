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
    <td><b>count</b></td>
    <td>On top level, max number of children allowed</td>
    <td>1</td>
</tr>
<tr>
    <td><b>minR</b></td>
    <td>Minimum Radius an object can be placed</td>
    <td>0</td>
</tr>
<tr>
    <td><b>maxR</b></td>
    <td>Maximum Radius an object can be placed</td>
    <td>0.7</td>
</tr>
<tr>
    <td><b>canMirror</b></td>
    <td>Whether an object can be mirrored.</td>
    <td>0</td>
</tr>
<tr>
    <td><b>defaultMirror</b></td>
    <td>Whether an object defaults to being mirrored</td>
    <td>1</td>
</tr>
</table>

## Notes

* When exporting a new GLTF remember to check 'Custom Properties' in the exporter.
* If you update the dependencies in node clear the node_modules and install only the dependencies not dev dependencies before commiting to Git.

```
rn -rf node_modules
npm install --production
```