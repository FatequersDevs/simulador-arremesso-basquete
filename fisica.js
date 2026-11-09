const gravidade = 9.81;
const altura_aro = 3.05;

function ConverterParaRadiano(anguloGraus) {
    return anguloGraus * (Math.PI / 180);
}

export function calcularArremesso(distancia, altura, saida) {
        if (
        !Number.isFinite(distancia) ||
        !Number.isFinite(alturaSaida) ||
        !Number.isFinite(anguloGraus) ||
        distancia <= 0 ||
        alturaSaida < 0 ||
        anguloGraus <= -90 ||
        anguloGraus >= 90
    ) {
        return null;
    }

    const anguloRad = ConverterParaRadiano(anguloGraus);
    const seno = Math.sin(anguloRad);
    const cosseno = Math.cos(anguloRad);

    // d = v0 * t * cos(θ)
    //
    // v0 = d / (t * cos(θ))

    // ALTURA_ARO = alturaSaida
    // + distancia * tan(θ)
    // - (GRAVIDADE * t²) / 2

    const diferencaAltura = ALTURA_ARO - alturaSaida;
    const tempoQuadrado =
        (2 * (distancia * (seno / cosseno) - diferencaAltura))
        / GRAVIDADE;


    if (!Number.isFinite(tempoQuadrado) || tempoQuadrado <= 0) {
        return null;
    }

    const tempoAteAro = Math.sqrt(tempoQuadrado);
    const velocidade = distancia / (tempoAteAro * cosseno);
    const velocidadeVertical =
        velocidade * seno - GRAVIDADE * tempoAteAro;

    if (
        !Number.isFinite(velocidade) ||
        !Number.isFinite(tempoAteAro) ||
        velocidadeVertical >= 0
    ) {
        return null;
    }

    return {
        velocidade,
        tempoAteAro
    };
}

export function posicaoDaBola(tempo, alturaSaida, anguloGraus, velocidade) {

    if (
        !Number.isFinite(tempo) ||
        !Number.isFinite(alturaSaida) ||
        !Number.isFinite(anguloGraus) ||
        !Number.isFinite(velocidade) ||
        tempo < 0 ||
        alturaSaida < 0 ||
        anguloGraus <= -90 ||
        anguloGraus >= 90 ||
        velocidade < 0
    ) {
        return null;
    }

    const anguloRad = converterParaRadiano(anguloGraus);
    const x = velocidade * tempo * Math.cos(anguloRad);
    const y =
        alturaSaida +
        velocidade * tempo * Math.sin(anguloRad) -
        (GRAVIDADE * tempo ** 2) / 2;

    return {
        x,
        y
    };

}