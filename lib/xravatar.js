
class XRAvatar {
    constructor (data) {
        this.data = data;
    }
    async init (Assembler) {
        const gltfPath = this.data.modelURL;
        const assembler = new Assembler(gltfPath);
        this.model = await assembler.assemble(this.data);
    }
}

export {
    XRAvatar
}