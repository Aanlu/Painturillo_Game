/**
 * @file Servidor principal del juego usando Node.js, Express y Socket.IO.
 * @description Gestiona la creación de salas, conexión de jugadores, y toda la lógica del juego.
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const os = require("os");

const app = express();
const servidor = http.createServer(app);
const io = new Server(servidor);

app.use(express.static(path.join(__dirname, "public")));

// Almacenamiento de las salas en memoria.
const salas = new Map();

// Palabras disponibles para el juego.
const PALABRAS = [
    "casa", "perro", "gato", "sol", "luna", "árbol", "coche", "río", "montaña", "flor",
    "puente", "llave", "barco", "avión", "guitarra", "reloj", "teléfono", "silla", "mesa", "libro",
    "computadora", "elefante", "jirafa", "serpiente", "mariposa", "helado", "pizza", "hamburguesa",
    "castillo", "dragón", "estrella", "corazón", "escalera", "fantasma", "sombrero"
];

// Paleta de colores para asignar a los jugadores.
const COLORES_JUGADOR = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#F0B37E', 
    '#8B9EB7', '#97C1A9', '#FFD8A8', '#A2D5F2', '#F3A683'
];

const PUNTOS_PARA_DIBUJANTE = 20;

// --- Funciones de Ayuda (Helpers) ---

/**
 * Genera un nombre de usuario único para una sala, añadiendo un sufijo numérico si es necesario.
 * @param {Array<object>} jugadores - La lista de jugadores actuales en la sala.
 * @param {string} nombreDeseado - El nombre que el jugador quiere usar.
 * @returns {string} El nombre final y único del jugador.
 */
function obtenerNombreUnico(jugadores, nombreDeseado) {
    let nombreFinal = nombreDeseado;
    let intentos = 0;
    while (jugadores.some(p => p.nombre === nombreFinal)) {
        const sufijo = Math.floor(10 + Math.random() * 90);
        nombreFinal = `${nombreDeseado}${sufijo}`;
        intentos++;
        if (intentos > 10) {
            nombreFinal = `${nombreDeseado}${Date.now().toString().slice(-4)}`;
            break;
        }
    }
    return nombreFinal;
}

/**
 * Normaliza un string para comparaciones (minúsculas, sin acentos, sin espacios extra).
 * @param {string} str - El string a normalizar.
 * @returns {string} El string normalizado.
 */
function normalizarString(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Envía la lista de jugadores actualizada a todos en una sala, indicando quién es el anfitrión.
 * @param {string} idSala - El ID de la sala a actualizar.
 */
function actualizarListaJugadores(idSala) {
    const sala = salas.get(idSala);
    if (sala) {
        const jugadoresConAnfitrion = sala.jugadores.map(jugador => ({
            ...jugador,
            esAnfitrion: jugador.id === sala.idAnfitrion
        }));
        io.to(idSala).emit("lobby:actualizar", jugadoresConAnfitrion);
    }
}

// --- Lógica Principal del Juego ---

/**
 * Inicia la partida en una sala específica.
 * @param {string} idSala - El ID de la sala.
 */
function iniciarPartida(idSala) {
    const sala = salas.get(idSala);
    if (!sala) return;

    sala.juego = {}; // Marca la sala como 'en juego' para evitar que se borre

    const urlJuego = `game.html?idSala=${idSala}`;
    io.to(idSala).emit("juego:navegar", { url: urlJuego });

    setTimeout(() => {
        sala.juego = {
            ronda: 0, palabra: "", idDibujante: null,
            jugadoresQueAdivinaron: new Set(), jugadoresQueHanDibujado: new Set(),
            temporizadorRonda: null, intervaloPistas: null, tiempoRestante: 60
        };
        sala.jugadores.forEach(p => p.puntaje = 0);
        io.to(idSala).emit("juego:actualizar-puntajes", sala.jugadores);
        iniciarNuevaRonda(idSala);
    }, 500);
}

/**
 * Comienza una nueva ronda, eligiendo un nuevo dibujante y palabras.
 * @param {string} idSala - El ID de la sala.
 */
function iniciarNuevaRonda(idSala) {
    const sala = salas.get(idSala);
    if (!sala || !sala.juego) return;

    if (sala.juego.temporizadorRonda) clearInterval(sala.juego.temporizadorRonda);
    if (sala.juego.intervaloPistas) clearInterval(sala.juego.intervaloPistas);

    sala.juego.ronda++;
    if (sala.juego.ronda > 5) {
        io.to(idSala).emit("juego:finalizado", { jugadores: sala.jugadores });
        delete sala.juego;
        return;
    }

    // Lógica de rotación justa: se basa en el nombre único que es persistente.
    let dibujantesDisponibles = sala.jugadores.filter(p => !sala.juego.jugadoresQueHanDibujado.has(p.nombre));
    if (dibujantesDisponibles.length === 0) {
        sala.juego.jugadoresQueHanDibujado.clear();
        dibujantesDisponibles = sala.jugadores;
    }
    const dibujante = dibujantesDisponibles[Math.floor(Math.random() * dibujantesDisponibles.length)];
    sala.juego.idDibujante = dibujante.id;
    sala.juego.jugadoresQueHanDibujado.add(dibujante.nombre);
    sala.juego.jugadoresQueAdivinaron.clear();

    const opcionesPalabra = [...PALABRAS].sort(() => 0.5 - Math.random()).slice(0, 3);
    
    io.to(idSala).emit("juego:mensaje-sistema", { texto: `está eligiendo una palabra...`, nombreJugador: dibujante.nombre, colorJugador: dibujante.color });
    io.to(idSala).emit("juego:nueva-ronda", { ronda: sala.juego.ronda, idDibujante: dibujante.id, nombreDibujante: dibujante.nombre });
    io.to(dibujante.id).emit("juego:elegir-palabra", { opciones: opcionesPalabra });
}

/**
 * Una vez que el dibujante elige una palabra, comienza la fase de dibujo.
 * @param {string} idSala - El ID de la sala.
 * @param {string} palabra - La palabra elegida.
 */
function iniciarFaseDeDibujo(idSala, palabra) {
    const sala = salas.get(idSala);
    if (!sala || !sala.juego) return;

    sala.juego.palabra = palabra;
    const mascara = "_ ".repeat(palabra.length).trim();

    const dibujante = sala.jugadores.find(p => p.id === sala.juego.idDibujante);
    if (dibujante) {
        io.to(idSala).emit("juego:mensaje-sistema", { texto: `ha elegido una palabra. ¡A dibujar!`, nombreJugador: dibujante.nombre, colorJugador: dibujante.color });
    }
    
    io.to(idSala).emit("juego:actualizar-estado", { texto: "¡Adivina la palabra!" });
    io.to(sala.juego.idDibujante).emit("juego:actualizar-estado", { texto: "¡Te toca dibujar!" });
    
    io.to(idSala).emit("juego:mascara-palabra", { mascara });
    io.to(sala.juego.idDibujante).emit("juego:mascara-palabra", { mascara: palabra });

    sala.juego.tiempoRestante = 60;
    io.to(idSala).emit("juego:temporizador", { tiempoRestante: sala.juego.tiempoRestante });

    sala.juego.temporizadorRonda = setInterval(() => {
        sala.juego.tiempoRestante--;
        io.to(idSala).emit("juego:temporizador", { tiempoRestante: sala.juego.tiempoRestante });
        if (sala.juego.tiempoRestante <= 0) {
            io.to(idSala).emit("juego:fin-ronda", { palabra: sala.juego.palabra });
            iniciarNuevaRonda(idSala);
        }
    }, 1000);

    const indicesRevelados = new Set();
    const maxPistas = Math.floor(palabra.length / 2);
    sala.juego.intervaloPistas = setInterval(() => {
        if (indicesRevelados.size >= maxPistas || sala.juego.tiempoRestante < 10) return;
        let indiceAleatorio;
        do {
            indiceAleatorio = Math.floor(Math.random() * palabra.length);
        } while (indicesRevelados.has(indiceAleatorio));

        indicesRevelados.add(indiceAleatorio);
        io.to(idSala).emit("juego:pista", { indice: indiceAleatorio, letra: palabra[indiceAleatorio] });
    }, 8000);
}

// --- Manejadores de Eventos de Socket ---
io.on("connection", (socket) => {
    console.log(`Nuevo jugador conectado: ${socket.id}`);

    socket.on("sala:crear", ({ nombreJugador, minJugadores, maxJugadores }, callback) => {
        const idSala = Math.random().toString(36).slice(2, 7).toUpperCase();
        const sala = { id: idSala, idAnfitrion: null, jugadores: [], minJugadores: minJugadores || 2, maxJugadores: maxJugadores || 8 };
        salas.set(idSala, sala);
        callback({ ok: true, idSala });
    });

    socket.on("sala:unirse", ({ idSala, nombreJugador }, callback) => {
        const sala = salas.get(idSala);
        if (!sala) return callback({ ok: false, error: "La sala no existe" });
        if (sala.jugadores.length >= sala.maxJugadores && !sala.jugadores.some(p => p.nombre === nombreJugador)) {
             return callback({ ok: false, error: "La sala está llena" });
        }

        if (sala.jugadores.length === 0) sala.idAnfitrion = socket.id;

        // Lógica de reconexión para preservar el color y los datos del jugador.
        let jugadorExistente = sala.jugadores.find(p => p.nombre === nombreJugador);
        if (jugadorExistente) {
            jugadorExistente.id = socket.id;
        } else {
            const nombreFinal = obtenerNombreUnico(sala.jugadores, nombreJugador);
            const color = COLORES_JUGADOR[sala.jugadores.length % COLORES_JUGADOR.length];
            sala.jugadores.push({ id: socket.id, nombre: nombreFinal, puntaje: 0, color: color });
        }
        
        socket.join(idSala);
        
        actualizarListaJugadores(idSala);
        socket.emit("sala:datos", sala);
        const jugadorActual = sala.jugadores.find(p => p.id === socket.id);
        callback({ ok: true, nombreFinal: jugadorActual.nombre });
    });

    socket.on("lobby:chat", ({ idSala, mensaje }) => {
        const sala = salas.get(idSala);
        if (!sala || !mensaje || mensaje.trim().length === 0) return;
        const remitente = sala.jugadores.find(p => p.id === socket.id);
        if (!remitente) return;
        io.to(idSala).emit("lobby:chat", { nombre: remitente.nombre, texto: mensaje, esAnfitrion: remitente.id === sala.idAnfitrion, color: remitente.color });
    });

    socket.on("disconnect", () => {
        console.log(`Jugador desconectado: ${socket.id}`);
        for (const [idSala, sala] of salas.entries()) {
            const indiceJugador = sala.jugadores.findIndex(p => p.id === socket.id);
            if (indiceJugador !== -1) {
                const eraAnfitrion = sala.idAnfitrion === socket.id;
                sala.jugadores.splice(indiceJugador, 1);
                
                if (sala.jugadores.length === 0 && !sala.juego) {
                    salas.delete(idSala);
                    console.log(`Sala ${idSala} eliminada por estar vacía.`);
                } else if (sala.jugadores.length > 0) {
                    if (eraAnfitrion) sala.idAnfitrion = sala.jugadores[0].id;
                    actualizarListaJugadores(idSala);
                }
                break;
            }
        }
    });

    socket.on("juego:iniciar", ({ idSala }) => iniciarPartida(idSala));
    socket.on("juego:elegir", ({ idSala, palabra }) => iniciarFaseDeDibujo(idSala, palabra));

    socket.on("dibujo:iniciar-trazo", ({ idSala, trazo }) => socket.to(idSala).emit("dibujo:iniciar-trazo", { trazo }));
    socket.on("dibujo:trazar", ({ idSala, trazo }) => socket.to(idSala).emit("dibujo:trazar", { trazo }));
    socket.on("dibujo:limpiar", ({ idSala }) => socket.to(idSala).emit("dibujo:limpiar"));

    socket.on("juego:chat", ({ idSala, mensaje }) => {
        const sala = salas.get(idSala);
        if (!sala || !sala.juego) return;
        const jugador = sala.jugadores.find(p => p.id === socket.id);
        if (!jugador) return;

        const mensajeNormalizado = normalizarString(mensaje);
        const palabraNormalizada = normalizarString(sala.juego.palabra);

        if (mensajeNormalizado === palabraNormalizada) {
            if (!sala.juego.jugadoresQueAdivinaron.has(socket.id) && socket.id !== sala.juego.idDibujante) {
                // Puntaje para quien adivina
                jugador.puntaje += sala.juego.tiempoRestante;
                // Puntaje para el dibujante
                const dibujante = sala.jugadores.find(p => p.id === sala.juego.idDibujante);
                if (dibujante) dibujante.puntaje += PUNTOS_PARA_DIBUJANTE;
                
                sala.juego.jugadoresQueAdivinaron.add(socket.id);

                io.to(idSala).emit("juego:mensaje-sistema", { texto: `ha adivinado la palabra!`, nombreJugador: jugador.nombre, colorJugador: jugador.color });
                io.to(idSala).emit("juego:actualizar-puntajes", sala.jugadores);
                socket.emit("juego:mascara-palabra", { mascara: sala.juego.palabra });

                const adivinadores = sala.jugadores.filter(p => p.id !== sala.juego.idDibujante);
                if (sala.juego.jugadoresQueAdivinaron.size === adivinadores.length) {
                    io.to(idSala).emit("juego:fin-ronda", { palabra: sala.juego.palabra });
                    iniciarNuevaRonda(idSala);
                }
            }
        } else {
            io.to(idSala).emit("juego:mensaje-chat", { nombre: jugador.nombre, texto: mensaje, color: jugador.color });
        }
    });
});

const PORT = 3000;
servidor.listen(PORT, "0.0.0.0", () => {
    console.log("====================================");
    console.log(`Servidor escuchando en:`);
    const interfaces = os.networkInterfaces();
    for (const nombre of Object.keys(interfaces)) {
        for (const interfaz of interfaces[nombre]) {
            if (interfaz.family === "IPv4" && !interfaz.internal) {
                console.log(`- http://${interfaz.address}:${PORT}`);
            }
        }
    }
    console.log(`(También puedes usar http://localhost:${PORT})`);
    console.log("====================================");
});