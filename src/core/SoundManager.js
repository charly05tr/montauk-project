import * as THREE from 'three';

class SoundManager {
    constructor() {
        this.listener = null;
        this.audioLoader = new THREE.AudioLoader();
        this.audioBuffers = new Map(); // Cache de buffers (URL -> AudioBuffer)
        this.ambientSounds = new Map(); // Sonidos de ambiente activos (key -> THREE.Audio)
        this.positionalSounds = new Map(); // Sonidos posicionales activos (key -> { sound: THREE.PositionalAudio, mesh: THREE.Object3D })
        this.footstepCache = null; // Cache para los tiempos de pasos recortados
        this.keyboardCache = null; // Cache para los tiempos de teclado recortados
    }

    setListener(listener) {
        this.listener = listener;
        console.log('SoundManager: AudioListener registrado.');
    }

    async resumeContext() {
        const context = THREE.AudioContext.getContext();
        if (context.state === 'suspended') {
            try {
                await context.resume();
                console.log('SoundManager: AudioContext reanudado.');
            } catch (err) {
                console.error('SoundManager: Error al reanudar AudioContext', err);
            }
        }
        this._primeAudioContext(context);
    }

    _primeAudioContext(context) {
        try {
            const buffer = context.createBuffer(1, 1, context.sampleRate);
            const source = context.createBufferSource();
            source.buffer = buffer;
            const gain = context.createGain();
            gain.gain.value = 0;
            source.connect(gain);
            gain.connect(context.destination);
            source.start(context.currentTime);
            source.stop(context.currentTime + 0.001);
        } catch (e) {
            // Silently ignore priming errors
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

            // Evitar condición de carrera si el sonido fue detenido o reemplazado durante la carga
            if (this.ambientSounds.get(key) !== sound) {
                return;
            }

            sound.setBuffer(buffer);
            sound.setLoop(loop);
            sound.setVolume(volume);
            sound.play();
            console.log(`SoundManager: Reproduciendo ambiente "${key}"`);
        } catch (err) {
            if (this.ambientSounds.get(key) === sound) {
                this.ambientSounds.delete(key);
            }
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

            // Evitar condición de carrera si el sonido fue detenido o reemplazado durante la carga
            if (this.positionalSounds.get(key)?.sound !== sound) {
                return;
            }

            sound.setBuffer(buffer);
            mesh.add(sound);
            sound.play();

            console.log(`SoundManager: Reproduciendo sonido posicional "${key}" atado a ${mesh.name || 'objeto 3D'}`);
        } catch (err) {
            if (this.positionalSounds.get(key)?.sound === sound) {
                this.positionalSounds.delete(key);
            }
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

    /**
     * Reproduce el sonido del portal abriéndose.
     * Si /sounds/portal_opening.mp3 no existe, sintetiza un zumbido electromagnético.
     */
    playPortalOpenSound() {
        this.resumeContext();
        const path = '/sounds/portal_opening.mp3';
        this.loadBuffer(path)
            .then(() => {
                this.playAmbient('portal_open', path, false, 0.7);
            })
            .catch(() => {
                console.log('SoundManager: Archivo portal_opening.mp3 no encontrado. Generando sonido sintetizado...');
                this.playSynthesizedPortalOpen();
            });
    }

    /**
     * Genera un efecto sonoro de portal cósmico/electromagnético:
     * - Zumbido grave creciente (50Hz→120Hz)
     * - Shimmer agudo (tintinea de frecuencia alta)
     * - Ráfaga de ruido blanco filtrado
     * Duración total: ~4 segundos (cubre toda la secuencia del portal).
     */
    playSynthesizedPortalOpen() {
        const ctx = THREE.AudioContext.getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;

        // 1. Zumbido grave creciente (la base del portal)
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(50, now);
        bassOsc.frequency.exponentialRampToValueAtTime(120, now + 3.0);
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.15, now + 0.8);
        bassGain.gain.linearRampToValueAtTime(0.22, now + 2.5);
        bassGain.gain.linearRampToValueAtTime(0, now + 4.0);

        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(200, now);
        bassFilter.frequency.linearRampToValueAtTime(400, now + 3.0);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 4.0);

        // 2. Shimmer agudo (cristalino, como energía)
        const shimmerOsc = ctx.createOscillator();
        const shimmerGain = ctx.createGain();
        shimmerOsc.type = 'sine';
        shimmerOsc.frequency.setValueAtTime(2200, now);
        shimmerOsc.frequency.setValueAtTime(3400, now + 1.0);
        shimmerOsc.frequency.setValueAtTime(1800, now + 2.0);
        shimmerOsc.frequency.setValueAtTime(4000, now + 3.0);

        shimmerGain.gain.setValueAtTime(0, now);
        shimmerGain.gain.linearRampToValueAtTime(0.04, now + 1.0);
        shimmerGain.gain.linearRampToValueAtTime(0.08, now + 2.5);
        shimmerGain.gain.linearRampToValueAtTime(0, now + 3.8);

        shimmerOsc.connect(shimmerGain);
        shimmerGain.connect(ctx.destination);
        shimmerOsc.start(now);
        shimmerOsc.stop(now + 4.0);

        // 3. Ráfaga de ruido blanco al clímax (succión)
        const noiseLength = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseLength; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        const noiseGain = ctx.createGain();
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(800, now + 2.0);
        noiseFilter.Q.setValueAtTime(1.5, now + 2.0);

        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.setValueAtTime(0, now + 2.0);
        noiseGain.gain.linearRampToValueAtTime(0.12, now + 3.0);
        noiseGain.gain.linearRampToValueAtTime(0, now + 4.0);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noiseSource.start(now + 2.0);
        noiseSource.stop(now + 4.0);
    }

    /**
     * Analiza el buffer de audio para detectar picos de energía que correspondan a pasos.
     * Esto automatiza el recorte de cualquier archivo de pasos (como steps.mp3 de 8s).
     */
    detectFootsteps(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0); // Usar el canal izquierdo
        const sampleRate = audioBuffer.sampleRate;
        const length = channelData.length;

        // 1. Encontrar el pico absoluto de amplitud para establecer un umbral inteligente
        let maxVal = 0;
        for (let i = 0; i < length; i += 15) {
            const val = Math.abs(channelData[i]);
            if (val > maxVal) maxVal = val;
        }

        // Si es extremadamente silencioso, usar un umbral por defecto mínimo
        const threshold = Math.max(0.015, maxVal * 0.32);
        const minDistanceSamples = sampleRate * 0.42; // Mínimo 420ms entre pasos
        const windowSize = Math.floor(sampleRate * 0.05); // Ventana de 50ms para máximos locales

        const peakIndices = [];

        for (let i = 0; i < length; i += 5) {
            const val = Math.abs(channelData[i]);
            if (val > threshold) {
                // Verificar si es un pico local en su entorno
                let isLocalMax = true;
                const start = Math.max(0, i - windowSize);
                const end = Math.min(length, i + windowSize);
                for (let j = start; j < end; j += 5) {
                    if (Math.abs(channelData[j]) > val) {
                        isLocalMax = false;
                        break;
                    }
                }

                if (isLocalMax) {
                    // Verificar separación temporal con el paso anterior
                    if (peakIndices.length === 0 || (i - peakIndices[peakIndices.length - 1]) > minDistanceSamples) {
                        peakIndices.push(i);
                    }
                }
            }
        }

        // Convertir muestras a segundos
        let times = peakIndices.map(idx => idx / sampleRate);
        
        console.log(`[SoundManager] Análisis de pasos completado. Se detectaron ${times.length} pasos en:`, times);

        // Fallback en caso de que la detección falle o el audio sea plano
        if (times.length === 0) {
            const duration = audioBuffer.duration;
            for (let t = 0.2; t < duration - 0.5; t += 0.7) {
                times.push(t);
            }
            console.log('[SoundManager] Fallback: Usando intervalos regulares de pasos:', times);
        }

        return times;
    }

    /**
     * Reproduce una rodaja (slice) recortada de steps.mp3 correspondiente al siguiente paso en el ciclo.
     */
    async playFootstepSlice(path, volume = 0.5) {
        await this.resumeContext();

        let buffer;
        try {
            buffer = await this.loadBuffer(path);
        } catch (err) {
            console.error('[SoundManager] Error al cargar los pasos para reproducción recortada:', err);
            return;
        }

        // Si aún no hemos analizado y extraído los pasos de este archivo, lo hacemos ahora
        if (!this.footstepCache) {
            this.footstepCache = {
                times: this.detectFootsteps(buffer),
                index: 0
            };
        }

        const cache = this.footstepCache;
        if (cache.times.length === 0) return;

        // Obtener el tiempo del paso actual
        const peakTime = cache.times[cache.index];

        // Avanzar el índice de forma circular
        cache.index = (cache.index + 1) % cache.times.length;

        // Configurar nodos de Web Audio API para la reproducción
        const ctx = THREE.AudioContext.getContext();
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Recortamos la porción alrededor del pico
        // Empezamos un poco antes (70ms) para captar el ataque sutil del paso
        const startOffset = Math.max(0, peakTime - 0.07);
        // Duración de la rodaja para un paso (aproximadamente 400ms)
        const duration = 0.40;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        // Fade out rápido al final del paso para evitar clics de audio abruptos
        gainNode.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + duration - 0.04);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(ctx.currentTime, startOffset, duration);
    }

    /**
     * Analiza el buffer de audio para detectar picos de energía cortos correspondientes a clics de teclado.
     */
    detectKeyboardClicks(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0); // Canal izquierdo
        const sampleRate = audioBuffer.sampleRate;
        const length = channelData.length;

        // Encontrar pico de amplitud absoluto
        let maxVal = 0;
        for (let i = 0; i < length; i += 10) {
            const val = Math.abs(channelData[i]);
            if (val > maxVal) maxVal = val;
        }

        // Umbral adaptativo muy bajo porque los clics de teclado suelen ser breves y pueden ser suaves
        const threshold = Math.max(0.008, maxVal * 0.20);
        const minDistanceSamples = sampleRate * 0.08; // Mínimo 80ms entre clics (tecleado rápido)
        const windowSize = Math.floor(sampleRate * 0.015); // Ventana de 15ms para máximos locales

        const peakIndices = [];

        for (let i = 0; i < length; i += 2) { // Mayor resolución temporal (paso de 2 en 2)
            const val = Math.abs(channelData[i]);
            if (val > threshold) {
                let isLocalMax = true;
                const start = Math.max(0, i - windowSize);
                const end = Math.min(length, i + windowSize);
                for (let j = start; j < end; j += 2) {
                    if (Math.abs(channelData[j]) > val) {
                        isLocalMax = false;
                        break;
                    }
                }

                if (isLocalMax) {
                    if (peakIndices.length === 0 || (i - peakIndices[peakIndices.length - 1]) > minDistanceSamples) {
                        peakIndices.push(i);
                    }
                }
            }
        }

        // Convertir muestras a segundos
        let times = peakIndices.map(idx => idx / sampleRate);
        console.log(`[SoundManager] Análisis de teclado completado. Se detectaron ${times.length} clics en:`, times);

        // Fallback si no se detectan picos
        if (times.length === 0) {
            const duration = audioBuffer.duration;
            for (let t = 0.05; t < duration; t += 0.15) {
                times.push(t);
            }
            console.log('[SoundManager] Fallback: Usando intervalos regulares para clics de teclado:', times);
        }

        return times;
    }

    /**
     * Reproduce una rodaja (slice) recortada de keyboard.mp3 correspondiente al siguiente clic en el ciclo.
     */
    async playKeyboardSlice(path, volume = 0.5) {
        await this.resumeContext();

        let buffer;
        try {
            buffer = await this.loadBuffer(path);
        } catch (err) {
            console.error('[SoundManager] Error al cargar el sonido de teclado para reproducción recortada:', err);
            return;
        }

        if (!this.keyboardCache) {
            this.keyboardCache = {
                times: this.detectKeyboardClicks(buffer),
                index: 0
            };
        }

        const cache = this.keyboardCache;
        if (cache.times.length === 0) return;

        // Obtener el tiempo del clic actual
        const peakTime = cache.times[cache.index];

        // Avanzar el índice de forma circular
        cache.index = (cache.index + 1) % cache.times.length;

        // Configurar Web Audio API
        const ctx = THREE.AudioContext.getContext();
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Empezar un poco antes (30ms) para no cortar el ataque sutil del clic
        const startOffset = Math.max(0, peakTime - 0.03);
        // Duración corta para un clic de teclado (200ms)
        const duration = 0.20;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        // Desvanecimiento exponencial rápido para evitar clics abruptos al final
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration - 0.03);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(ctx.currentTime, startOffset, duration);
    }
}

export const soundManager = new SoundManager();
