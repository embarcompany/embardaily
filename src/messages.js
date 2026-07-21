export function touch1({ Cliente, Pet, Empresa }) {
  const name = Cliente?.split(" ")[0] || "tutor(a)";
  return `Olá, ${name}! Como vocês e ${Pet || "seu pet"} estão? Para nós, foi muito especial acompanhar esse embarque pela ${Empresa || "Embarpet"}. Se puder compartilhar: por que foi importante levar ${Pet || "seu pet"} com você nessa viagem? Seu relato nos ajuda muito. Se preferir não receber estas mensagens, responda SAIR.`;
}
export function touch2({ Cliente, Pet, Empresa }, reviewUrl) {
  const name = Cliente?.split(" ")[0] || "";
  return `Obrigada por compartilhar, ${name}! Ficamos muito felizes em saber da história de ${Pet || "vocês"}. Se puder, deixe esse relato (ou um resumo) como avaliação da ${Empresa || "Embarpet"} no Google: ${reviewUrl}`;
}
export function touch3({ Cliente, Pet }) {
  const name = Cliente?.split(" ")[0] || "";
  return `Obrigada, ${name}! Podemos usar seu relato sobre ${Pet || "o embarque"} em nosso Instagram? Responda: SIM, NÃO ou SIM SEM IDENTIFICAÇÃO.`;
}
export function reminder({ Cliente, Pet }) {
  return `Olá, ${Cliente?.split(" ")[0] || ""}! Passando só para lembrar: se quiser contar por que foi importante levar ${Pet || "seu pet"} nessa viagem, vamos adorar ouvir. Sem compromisso — e, se preferir não receber mensagens, responda SAIR.`;
}
