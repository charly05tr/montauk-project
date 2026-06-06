import * as THREE from 'three';

class SoundManager {
    constructor() {
        this.listener = null;
        this.audioLoader = new THREE.AudioLoader();
        this.audioBuffers = new Map(); // Cache de buffers (URL -> AudioBuffer)
        this.ambientSounds = new Map(); // Sonidos de ambiente activos (key -> THREE.Audio)
        this.positionalSounds = new Map(); // Sonidos posicionales activos (key -> { sound: THREE.PositionalAudio, mesh: THREE.Object3D })
    }

    setListener(listener) {
        this.listener = listener;
        console.log('SoundManager: AudioListener registrado.');
    }

    resumeContext() {
        const context = THREE.AudioContext.getContext();
        if (context.state === 'suspended') {
            context.resume().then(() => {
                console.log('SoundManager: AudioContext reanudado.');
            }).catch(err => {
                console.error('SoundManager: Error al reanudar AudioContext', err);
            });
        }
    }

    loadBuffer(path) {
        return new Promise((resolve, reject) => {
            if (this.audioBuffers.has(path)) {
                resolve(this.audioBuffers.get(path));
                return;
            }

            this.audioLoader.load(
                path,
                (buffer) => {
                    this.audioBuffers.set(path, buffer);
                    resolve(buffer);
                },
                undefined,
                (err) => {
                    console.error(`SoundManager: Error cargando el sonido en ${path}`, err);
                    reject(err);
                }
            );
        });
    }

    async playAmbient(key, path, loop = true, volume = 0.5) {
        if (!this.listener) {
            console.warn('SoundManager: No se puede reproducir audio sin un AudioListener registrado.');
            return;
        }

        // Si ya está reproduciéndose bajo esta clave, no hacemos nada
        if (this.ambientSounds.has(key)) {
            const existingSound = this.ambientSounds.get(key);
            if (!existingSound.isPlaying) {
                existingSound.play();
            }
            return;
        }

        try {
            const sound = new THREE.Audio(this.listener);
            this.ambientSounds.set(key, sound);

            const buffer = await this.loadBuffer(path);
            sound.setBuffer(buffer);
            sound.setLoop(loop);
            sound.setVolume(volume);
            sound.play();
            console.log(`SoundManager: Reproduciendo ambiente "${key}"`);
        } catch (err) {
            this.ambientSounds.delete(key);
        }
    }

    stopAmbient(key) {
        if (this.ambientSounds.has(key)) {
            const sound = this.ambientSounds.get(key);
            if (sound.isPlaying) {
                sound.stop();
            }
            this.ambientSounds.delete(key);
            console.log(`SoundManager: Ambiente "${key}" detenido.`);
        }
    }

    stopAllAmbient() {
        for (const [key, sound] of this.ambientSounds.entries()) {
            if (sound.isPlaying) {
                sound.stop();
            }
        }
        this.ambientSounds.clear();
        console.log('SoundManager: Todos los ambientes detenidos.');
    }

    async playPositional(key, path, mesh, options = {}) {
        if (!this.listener) {
            console.warn('SoundManager: No se puede reproducir audio posicional sin un AudioListener.');
            return;
        }

        if (!mesh) {
            console.warn(`SoundManager: No se proporcionó una malla para vincular el sonido espacial "${key}".`);
            return;
        }

        // Si ya existe este sonido posicional, lo detenemos y limpiamos
        this.stopPositional(key);

        try {
            const sound = new THREE.PositionalAudio(this.listener);
            
            // Configurar parámetros espaciales
            const refDistance = options.refDistance ?? 1;
            const maxDistance = options.maxDistance ?? 100;
            const rolloffFactor = options.rolloffFactor ?? 1;
            const loop = options.loop ?? false;
            const volume = options.volume ?? 1.0;

            sound.setRefDistance(refDistance);
            sound.setMaxDistance(maxDistance);
            sound.setRolloffFactor(rolloffFactor);
            sound.setLoop(loop);
            sound.setVolume(volume);

            this.positionalSounds.set(key, { sound, mesh });

            const buffer = await this.loadBuffer(path);
            sound.setBuffer(buffer);
            mesh.add(sound);
            sound.play();

            console.log(`SoundManager: Reproduciendo sonido posicional "${key}" atado a ${mesh.name || 'objeto 3D'}`);
        } catch (err) {
            this.positionalSounds.delete(key);
        }
    }

    stopPositional(key) {
        if (this.positionalSounds.has(key)) {
            const { sound, mesh } = this.positionalSounds.get(key);
            if (sound.isPlaying) {
                sound.stop();
            }
            if (mesh) {
                mesh.remove(sound);
            }
            this.positionalSounds.delete(key);
            console.log(`SoundManager: Sonido posicional "${key}" detenido.`);
        }
    }

    stopAllPositional() {
        for (const [key, { sound, mesh }] of this.positionalSounds.entries()) {
            if (sound.isPlaying) {
                sound.stop();
            }
            if (mesh) {
                mesh.remove(sound);
            }
        }
        this.positionalSounds.clear();
        console.log('SoundManager: Todos los sonidos posicionales detenidos.');
    }

    /**
     * Intenta reproducir el archivo de sonido de la puerta. 
     * Si no existe o falla la carga, sintetiza el sonido mediante la Web Audio API.
     */
    playDoorOpenSound() {
        this.resumeContext();
        const path = '/sounds/door_open.mp3';
        this.loadBuffer(path)
            .then(() => {
                this.playAmbient('door_open', path, false, 0.8);
            })
            .catch(() => {
                console.log('SoundManager: Archivo /sounds/door_open.mp3 no encontrado. Generando sonido sintetizado...');
                this.playSynthesizedDoorOpen();
            });
    }

    /**
     * Genera un efecto de sonido analógico retro (chirrido de madera y portazo)
     * usando la Web Audio API directamente.
     */
    playSynthesizedDoorOpen() {
        const ctx = THREE.AudioContext.getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;

        // 1. Chirrido (Fricción de la madera al abrirse)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(70, now);
        
        // Simular rugosidad de la madera variando aleatoriamente la frecuencia
        for (let i = 0; i < 25; i++) {
            const t = now + i * 0.04;
            osc.frequency.setValueAtTime(60 + Math.random() * 35, t);
        }

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, now);
        filter.Q.setValueAtTime(2.5, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.15);
        gain.gain.linearRampToValueAtTime(0.0, now + 0.95);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.0);

        // 2. Portazo/Golpe sordo (Slam) a los 0.75s
        const slamTime = now + 0.75;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        const filter2 = ctx.createBiquadFilter();

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(100, slamTime);
        osc2.frequency.exponentialRampToValueAtTime(0.01, slamTime + 0.35);

        filter2.type = 'lowpass';
        filter2.frequency.setValueAtTime(130, slamTime);

        gain2.gain.setValueAtTime(0, now);
        gain2.gain.setValueAtTime(0.35, slamTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, slamTime + 0.35);

        osc2.connect(filter2);
        filter2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(slamTime);
        osc2.stop(slamTime + 0.4);
    }
}

export const soundManager = new SoundManager();
