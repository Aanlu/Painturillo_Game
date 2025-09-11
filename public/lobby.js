/**
 * @file Script para la página del lobby (lobby.html).
 * @description Gestiona la lista de jugadores, el chat y el inicio de la partida.
 */

const socket = io();
const $ = (id) => document.getElementById(id);

// --- Elementos del DOM ---
const elCodigoSala = $("codigoSala");
const elListaJugadores = $("listaJugadores");
const elMinJugadores = $("minJugadores");
const elMaxJugadores = $("maxJugadores");
const btnIniciarPartida = $("btnIniciarPartida");
const btnVolverInicio = $("btnVolverInicio");
const elCajaChat = $("cajaChat");
const elCampoChat = $("campoChat");
const btnEnviarChat = $("btnEnviarChat");

// --- Estado del Cliente ---
const parametros = new URLSearchParams(location.search);
const idSala = parametros.get("idSala");
let miNombre = parametros.get("nombre");
// Esta variable ahora puede cambiar si el anfitrión original se va.
let esAnfitrion = parametros.get("esAnfitrion") === 'true'; 

// Variable local para guardar los datos de la sala y evitar errores de timing.
let datosSala = {};

if (elCodigoSala && idSala) elCodigoSala.textContent = idSala;

// Al cargar la página, informamos al servidor que nos hemos unido.
socket.emit("sala:unirse", { idSala, nombreJugador: miNombre }, (respuesta) => {
    if (!respuesta.ok) {
        alert(respuesta.error || "No se pudo conectar a la sala.");
        window.location.href = "index.html";
    } else {
        // El servidor nos devuelve nuestro nombre final (en caso de que estuviera repetido).
        miNombre = respuesta.nombreFinal;
    }
});

// --- Manejadores de Eventos de Socket ---

/**
 * Recibe los datos estáticos de la sala (min/max jugadores).
 */
socket.on("sala:datos", (sala) => {
    datosSala = sala;
    elMinJugadores.textContent = sala.minJugadores;
    elMaxJugadores.textContent = sala.maxJugadores;
});

/**
 * Recibe la lista de jugadores actualizada y la renderiza.
 * También actualiza el estado del botón "Iniciar Partida" y el estado de anfitrión local.
 */
socket.on("lobby:actualizar", (jugadores) => {
    elListaJugadores.innerHTML = "";

    // Comprobamos si, según el servidor, ahora somos el anfitrión.
    // Esto es clave para cuando el anfitrión original se desconecta.
    const yoMismo = jugadores.find(p => p.id === socket.id);
    if (yoMismo && yoMismo.esAnfitrion) {
        esAnfitrion = true;
    }

    jugadores.forEach(jugador => {
        const li = document.createElement("li");
        let contenido = jugador.nombre;
        if (jugador.esAnfitrion) contenido += " 👑";
        if (jugador.id === socket.id) contenido += " (tú)";
        li.textContent = contenido;
        li.style.color = jugador.color;
        elListaJugadores.appendChild(li);
    });

    // Lógica para habilitar/deshabilitar el botón de inicio.
    const minJugadores = datosSala.minJugadores || 2;
    if (esAnfitrion && jugadores.length >= minJugadores) {
        btnIniciarPartida.disabled = false;
        btnIniciarPartida.textContent = "¡Iniciar Partida!";
    } else if (esAnfitrion) {
        btnIniciarPartida.disabled = true;
        const faltantes = minJugadores - jugadores.length;
        btnIniciarPartida.textContent = `Faltan ${faltantes} jugador${faltantes > 1 ? 'es' : ''}...`;
    } else {
        btnIniciarPartida.disabled = true;
        btnIniciarPartida.textContent = "Esperando al anfitrión...";
    }
});

/**
 * Recibe un mensaje de chat y lo añade a la caja de chat.
 */
socket.on("lobby:chat", ({ nombre, texto, esAnfitrion, color }) => {
    const elMensaje = document.createElement("div");
    const indicadorAnfitrion = esAnfitrion ? "👑 " : "";
    elMensaje.innerHTML = `${indicadorAnfitrion}<strong style="color: ${color};">${nombre}:</strong> ${texto}`;
    elCajaChat.appendChild(elMensaje);
    elCajaChat.scrollTop = elCajaChat.scrollHeight;
});

/**
 * Recibe la orden del servidor de navegar a la página del juego.
 */
socket.on("juego:navegar", ({ url }) => {
    const urlFinal = `${url}&nombre=${encodeURIComponent(miNombre)}`;
    window.location.href = urlFinal;
});


// --- Eventos de Botones y Entradas ---

btnVolverInicio.onclick = () => { window.location.href = "index.html"; };
btnIniciarPartida.onclick = () => { socket.emit("juego:iniciar", { idSala }); };

/**
 * Envía un mensaje de chat al servidor.
 */
function enviarMensajeChat() {
    const mensaje = elCampoChat.value.trim();
    if (mensaje.length > 0) {
        socket.emit("lobby:chat", { idSala, mensaje });
        elCampoChat.value = "";
    }
}

btnEnviarChat.onclick = enviarMensajeChat;
elCampoChat.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        enviarMensajeChat();
    }
});