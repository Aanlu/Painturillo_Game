/**
 * @file Script para la página de inicio (index.html).
 * @description Gestiona la creación y unión a salas.
 */

const socket = io();

/**
 * Alias para document.getElementById para facilitar la selección de elementos.
 * @param {string} id - El ID del elemento HTML.
 * @returns {HTMLElement} El elemento del DOM.
 */
const $ = (id) => document.getElementById(id);

// --- Elementos del DOM ---
const campoNombreJugador = $("campoNombreJugador");
const campoMinJugadores = $("campoMinJugadores");
const campoMaxJugadores = $("campoMaxJugadores");
const campoIdSala = $("campoIdSala");
const btnCrearSala = $("btnCrearSala");
const btnUnirseSala = $("btnUnirseSala");

/**
 * Redirige al usuario a una nueva URL con parámetros codificados.
 * @param {string} url - La URL base a la que redirigir (ej. "lobby.html").
 * @param {object} parametros - Un objeto con los parámetros para añadir a la URL.
 */
function irA(url, parametros) {
    const q = new URLSearchParams(parametros).toString();
    window.location.href = `${url}?${q}`;
}

// --- Eventos de Botones ---

/**
 * Maneja el clic en el botón "Crear sala".
 * Recoge los datos del formulario, los envía al servidor y redirige al lobby.
 */
btnCrearSala.onclick = () => {
    const nombre = campoNombreJugador.value.trim();
    if (!nombre) return alert("Ingresa tu nombre");

    const minJugadores = parseInt(campoMinJugadores.value, 10);
    const maxJugadores = parseInt(campoMaxJugadores.value, 10);

    const datosSala = { nombreJugador: nombre, minJugadores, maxJugadores };

    // 1. Pide al servidor crear la sala con los datos proporcionados.
    socket.emit("sala:crear", datosSala, (respuesta) => {
        if (!respuesta.ok) return alert(respuesta.error || "Error al crear sala");
        
        // 2. Si la creación es exitosa, redirige al lobby como anfitrión.
        irA("lobby.html", { idSala: respuesta.idSala, nombre, esAnfitrion: true });
    });
};

/**
 * Maneja el clic en el botón "Unirse a sala".
 * Recoge los datos y redirige al lobby si la unión es exitosa.
 */
btnUnirseSala.onclick = () => {
    const nombre = campoNombreJugador.value.trim();
    const idSala = campoIdSala.value.trim().toUpperCase();
    if (!nombre) return alert("Ingresa tu nombre");
    if (!idSala) return alert("Ingresa el ID de la sala");

    // Pide al servidor unirse a la sala. No se marca como anfitrión.
    socket.emit("sala:unirse", { idSala, nombreJugador: nombre }, (respuesta) => {
        if (!respuesta.ok) return alert(respuesta.error || "No se pudo entrar a la sala");
        irA("lobby.html", { idSala, nombre });
    });
};