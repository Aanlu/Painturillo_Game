/**
 * @file Script para la página del juego (game.html).
 * @description Gestiona el canvas, el chat y todos los eventos de la partida.
 */

const socket = io();
const parametros = new URLSearchParams(location.search);
const idSala = parametros.get("idSala");
const miNombre = parametros.get("nombre");

// Informamos al servidor que nos hemos unido a la sala del juego.
socket.emit("sala:unirse", { idSala, nombreJugador: miNombre }, (respuesta) => {
    if (!respuesta.ok) {
        alert(respuesta.error || "No se pudo reconectar a la sala.");
        window.location.href = "index.html";
    }
});

const $ = (id) => document.getElementById(id);

// --- Elementos del DOM ---
const lienzo = $("lienzo");
const contexto = lienzo.getContext("2d");
const elMascara = $("mascaraPalabra");
const elEstado = $("estadoJuego");
const elEtiquetaRonda = $("etiquetaRonda");
const elTemporizador = $("temporizador");
const elMarcador = $("marcador");
const elCajaChat = $("cajaChat");
const elCampoChat = $("campoChat");
const btnEnviarChat = $("btnEnviarChat");
const modalEleccion = $("modalEleccion");
const elOpcionesPalabra = $("opcionesPalabra");
const btnLimpiar = $("btnLimpiar");
const sliderGrosorPincel = $("grosorPincel");
const elVistaPreviaPincel = $("vistaPreviaPincel");
const modalFinPartida = $("modalFinPartida");
const elPuntajesFinales = $("puntajesFinales");
const btnIrALobby = $("btnIrALobby");
const btnIrAInicio = $("btnIrAInicio");
const elTemporizadorFinPartida = $("temporizadorFinPartida");

// --- Estado del Cliente ---
let puedeDibujar = false;
let miColor = "#000000";
let estaDibujando = false;
let miGrosorPincel = 5;
let ultimoPunto = null; // Para el suavizado de línea

// --- Funciones ---

/**
 * Añade un mensaje a la caja del chat.
 * @param {string} html - El contenido HTML del mensaje.
 * @param {string} [className=''] - Una clase CSS opcional para el mensaje.
 */
function agregarMensajeAlChat(html, className = '') {
    const elMensaje = document.createElement("div");
    elMensaje.className = className;
    elMensaje.innerHTML = html;
    elCajaChat.appendChild(elMensaje);
    elCajaChat.scrollTop = elCajaChat.scrollHeight;
}

/**
 * Actualiza el círculo que muestra el grosor y color del pincel.
 */
function actualizarVistaPreviaPincel() {
    elVistaPreviaPincel.style.width = `${miGrosorPincel}px`;
    elVistaPreviaPincel.style.height = `${miGrosorPincel}px`;
    elVistaPreviaPincel.style.backgroundColor = miColor === '#FFFFFF' ? 'transparent' : miColor;
    elVistaPreviaPincel.style.border = miColor === '#FFFFFF' ? '2px dashed #94a3b8' : '1px solid #334155';
}

/**
 * Obtiene las coordenadas del mouse o toque relativas al canvas.
 * @param {MouseEvent|TouchEvent} e - El evento del mouse o táctil.
 * @returns {{x: number, y: number}} Las coordenadas relativas.
 */
function obtenerPosicion(e) {
    const rect = lienzo.getBoundingClientRect();
    const scaleX = lienzo.width / rect.width;
    const scaleY = lienzo.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

/**
 * Dibuja una línea y emite el trazo al servidor.
 * @param {MouseEvent|TouchEvent} e - El evento del mouse o táctil.
 */
function dibujar(e) {
    if (!estaDibujando || !puedeDibujar) return;
    const puntoActual = obtenerPosicion(e);
    
    const trazo = {
        x: puntoActual.x, y: puntoActual.y,
        color: miColor,
        grosor: miColor === "#FFFFFF" ? miGrosorPincel * 4 : miGrosorPincel
    };
    socket.emit("dibujo:trazar", { idSala, trazo });

    renderizarTrazo(trazo);
}

/**
 * Renderiza un trazo en el canvas. Incluye lógica de suavizado para líneas curvas.
 * @param {{x: number, y: number, color: string, grosor: number}} trazo - El trazo a dibujar.
 */
function renderizarTrazo(trazo) {
    contexto.lineWidth = trazo.grosor;
    contexto.strokeStyle = trazo.color;
    contexto.lineCap = "round";
    contexto.lineJoin = "round";

    // Lógica de suavizado: Dibuja una curva hacia el punto medio del último punto y el actual.
    if (ultimoPunto) {
        const puntoMedio = { x: (ultimoPunto.x + trazo.x) / 2, y: (ultimoPunto.y + trazo.y) / 2 };
        contexto.quadraticCurveTo(ultimoPunto.x, ultimoPunto.y, puntoMedio.x, puntoMedio.y);
    }
    
    ultimoPunto = { x: trazo.x, y: trazo.y };
    contexto.stroke();
}

/**
 * Comienza un nuevo trazo de dibujo.
 * @param {MouseEvent|TouchEvent} e - El evento del mouse o táctil.
 */
function iniciarTrazo(e) {
    if (!puedeDibujar) return;
    estaDibujando = true;
    const punto = obtenerPosicion(e);
    ultimoPunto = punto;

    const trazoInicial = { 
        x: punto.x, y: punto.y, 
        color: miColor, 
        grosor: miColor === "#FFFFFF" ? miGrosorPincel * 4 : miGrosorPincel 
    };
    socket.emit("dibujo:iniciar-trazo", { idSala, trazo: trazoInicial });
    contexto.beginPath();
    contexto.moveTo(punto.x, punto.y);
    // Para que un punto se dibuje con solo un clic
    contexto.lineTo(punto.x, punto.y); 
    contexto.stroke();
}


// --- Event Listeners de Dibujo ---
lienzo.addEventListener("mousedown", iniciarTrazo);
lienzo.addEventListener("touchstart", (e) => { e.preventDefault(); iniciarTrazo(e); });
lienzo.addEventListener("mouseup", () => { estaDibujando = false; ultimoPunto = null; contexto.beginPath(); });
lienzo.addEventListener("touchend", () => { estaDibujando = false; ultimoPunto = null; contexto.beginPath(); });
lienzo.addEventListener("mouseout", () => { estaDibujando = false; ultimoPunto = null; contexto.beginPath(); });
lienzo.addEventListener("mousemove", dibujar);
lienzo.addEventListener("touchmove", (e) => { e.preventDefault(); dibujar(e); });

document.querySelectorAll(".color").forEach(btn => {
    btn.onclick = () => {
        miColor = btn.dataset.color;
        actualizarVistaPreviaPincel();
    };
});

btnLimpiar.onclick = () => {
    if (!puedeDibujar) return;
    socket.emit("dibujo:limpiar", { idSala });
    contexto.clearRect(0, 0, lienzo.width, lienzo.height);
};

sliderGrosorPincel.oninput = () => {
    miGrosorPincel = sliderGrosorPincel.value;
    actualizarVistaPreviaPincel();
};


// --- Manejadores de Eventos del Juego ---

socket.on("dibujo:iniciar-trazo", ({ trazo }) => {
    ultimoPunto = { x: trazo.x, y: trazo.y };
    contexto.beginPath();
    contexto.moveTo(trazo.x, trazo.y);
    contexto.lineTo(trazo.x, trazo.y);
    renderizarTrazo(trazo);
});
socket.on("dibujo:trazar", ({ trazo }) => renderizarTrazo(trazo));
socket.on("dibujo:limpiar", () => contexto.clearRect(0, 0, lienzo.width, lienzo.height));

socket.on("juego:nueva-ronda", ({ ronda, idDibujante, nombreDibujante }) => {
    modalFinPartida.classList.add("hidden");
    modalEleccion.classList.add("hidden");
    contexto.clearRect(0, 0, lienzo.width, lienzo.height);
    elEtiquetaRonda.textContent = ronda + "/5";
    
    puedeDibujar = (socket.id === idDibujante);
    elCampoChat.disabled = puedeDibujar;
    lienzo.style.pointerEvents = puedeDibujar ? "auto" : "none";
});

socket.on("juego:actualizar-estado", ({ texto }) => {
    elEstado.textContent = texto;
});

socket.on("juego:elegir-palabra", ({ opciones }) => {
    elOpcionesPalabra.innerHTML = "";
    opciones.forEach(palabra => {
        const btn = document.createElement("button");
        btn.textContent = palabra.toUpperCase();
        btn.onclick = () => {
            socket.emit("juego:elegir", { idSala, palabra });
            modalEleccion.classList.add("hidden");
        };
        elOpcionesPalabra.appendChild(btn);
    });
    modalEleccion.classList.remove("hidden");
});

socket.on("juego:mascara-palabra", ({ mascara }) => {
    elMascara.textContent = mascara;
});

socket.on("juego:temporizador", ({ tiempoRestante }) => {
    const minutos = Math.floor(tiempoRestante / 60).toString().padStart(2, '0');
    const segundos = (tiempoRestante % 60).toString().padStart(2, '0');
    elTemporizador.textContent = `${minutos}:${segundos}`;
});

socket.on("juego:pista", ({ indice, letra }) => {
    if (puedeDibujar) return;
    let mascaraActual = elMascara.textContent.split(" ");
    mascaraActual[indice] = letra;
    elMascara.textContent = mascaraActual.join(" ");
});

socket.on("juego:actualizar-puntajes", (jugadores) => {
    elMarcador.innerHTML = "";
    jugadores.sort((a, b) => b.puntaje - a.puntaje).forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.nombre} puntaje total: ${p.puntaje}`;
        li.style.color = p.color;
        elMarcador.appendChild(li);
    });
});

socket.on("juego:mensaje-chat", ({ nombre, texto, color }) => agregarMensajeAlChat(`<strong style="color: ${color};">${nombre}:</strong> ${texto}`));
socket.on("juego:mensaje-sistema", ({ texto, nombreJugador, colorJugador }) => {
    if (nombreJugador && colorJugador) {
        agregarMensajeAlChat(`<strong style="color: ${colorJugador};">${nombreJugador}</strong> ${texto}`, 'sys');
    } else {
        agregarMensajeAlChat(texto, 'sys');
    }
});

socket.on("juego:fin-ronda", ({ palabra }) => {
    elEstado.textContent = `La ronda terminó. La palabra era: ${palabra.toUpperCase()}`;
});

socket.on("juego:finalizado", ({ jugadores }) => {
    elEstado.textContent = `¡Juego terminado!`;
    
    elPuntajesFinales.innerHTML = "";
    jugadores.sort((a, b) => b.puntaje - a.puntaje).forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.nombre} puntaje total: ${p.puntaje}`;
        li.style.color = p.color;
        elPuntajesFinales.appendChild(li);
    });

    modalFinPartida.classList.remove("hidden");

    let cuentaRegresiva = 10;
    elTemporizadorFinPartida.textContent = `Volviendo al inicio en ${cuentaRegresiva}...`;
    const intervaloCuentaRegresiva = setInterval(() => {
        cuentaRegresiva--;
        elTemporizadorFinPartida.textContent = `Volviendo al inicio en ${cuentaRegresiva}...`;
        if (cuentaRegresiva <= 0) {
            clearInterval(intervaloCuentaRegresiva);
            window.location.href = "index.html";
        }
    }, 1000);

    btnIrALobby.onclick = () => {
        clearInterval(intervaloCuentaRegresiva);
        const yoMismo = jugadores.find(p => p.id === socket.id);
        const soyAnfitrion = yoMismo ? yoMismo.esAnfitrion : false;
        const parametros = new URLSearchParams({ idSala });
        if (soyAnfitrion) {
            parametros.append('esAnfitrion', 'true');
        }
        window.location.href = `lobby.html?${parametros.toString()}`;
    };

    btnIrAInicio.onclick = () => {
        clearInterval(intervaloCuentaRegresiva);
        window.location.href = "index.html";
    };
});

// --- Lógica de Envío ---
/**
 * Envía un mensaje de chat al servidor.
 */
function enviarMensajeChatJuego() {
    const mensaje = elCampoChat.value.trim();
    if (mensaje) {
        socket.emit("juego:chat", { idSala, mensaje });
        elCampoChat.value = "";
    }
}

btnEnviarChat.onclick = enviarMensajeChatJuego;
elCampoChat.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        enviarMensajeChatJuego();
    }
});

// Inicializa la vista previa del pincel al cargar
actualizarVistaPreviaPincel();