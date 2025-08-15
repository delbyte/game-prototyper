// Simplified Perlin noise implementation
export class PerlinNoise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.permutation = this.generatePermutation();
    }

    generatePermutation() {
        const p = [];
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }
        
        // Simple shuffle using seed
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        
        // Duplicate permutation
        for (let i = 0; i < 256; i++) {
            p[256 + i] = p[i];
        }
        
        return p;
    }

    random() {
        // Simple seeded random number generator
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }

    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y, z = 0) {
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
    fractalNoise(x, y, octaves = 4, persistence = 0.5, scale = 0.01) {
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
