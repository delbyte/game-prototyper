// Simplified Perlin noise implementation
export class PerlinNoise {
    seed: number;
    permutation: number[];

    constructor(seed?: number) {
        // Normalize seed to a number: use provided seed or a random 32-bit value
        const s = typeof seed === 'number' && Number.isFinite(seed) ? seed : Math.floor(Math.random() * 0xffffffff);
        // Use a numeric seed (integer)
        this.seed = Math.floor(s);
        // Build permutation deterministically using a local seeded PRNG so we don't mutate instance state during noise calls
        this.permutation = this.generatePermutation(this.seed);
    }

    // Mulberry32 seeded PRNG used locally to build the permutation table
    private mulberry32(a: number) {
        return function() {
            a |= 0;
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    generatePermutation(seed: number) {
        const rand = this.mulberry32(seed >>> 0);
        const p: number[] = new Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;

        // Fisher-Yates shuffle using local PRNG
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = p[i];
            p[i] = p[j];
            p[j] = tmp;
        }

        // Duplicate permutation
        const perm: number[] = new Array(512);
        for (let i = 0; i < 256; i++) perm[i] = p[i];
        for (let i = 0; i < 256; i++) perm[256 + i] = p[i];
        return perm;
    }

    fade(t: number) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a: number, b: number, t: number) {
        return a + t * (b - a);
    }

    grad(hash: number, x: number, y: number, z: number) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x: number, y: number, z: number = 0) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.permutation[X] + Y;
        const AA = this.permutation[A] + Z;
        const AB = this.permutation[A + 1] + Z;
        const B = this.permutation[X + 1] + Y;
        const BA = this.permutation[B] + Z;
        const BB = this.permutation[B + 1] + Z;

        return this.lerp(
            this.lerp(
                this.lerp(
                    this.grad(this.permutation[AA], x, y, z),
                    this.grad(this.permutation[BA], x - 1, y, z),
                    u
                ),
                this.lerp(
                    this.grad(this.permutation[AB], x, y - 1, z),
                    this.grad(this.permutation[BB], x - 1, y - 1, z),
                    u
                ),
                v
            ),
            this.lerp(
                this.lerp(
                    this.grad(this.permutation[AA + 1], x, y, z - 1),
                    this.grad(this.permutation[BA + 1], x - 1, y, z - 1),
                    u
                ),
                this.lerp(
                    this.grad(this.permutation[AB + 1], x, y - 1, z - 1),
                    this.grad(this.permutation[BB + 1], x - 1, y - 1, z - 1),
                    u
                ),
                v
            ),
            w
        );
    }

    // Fractal noise with multiple octaves
    fractalNoise(x: number, y: number, octaves: number = 4, persistence: number = 0.5, scale: number = 0.01) {
        let value = 0;
        let amplitude = 1;
        let frequency = scale;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.noise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return value / maxValue;
    }
}
