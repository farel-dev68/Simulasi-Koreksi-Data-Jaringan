"use strict";

const pages = [...document.querySelectorAll(".page")];

function showPage(pageId) {
  pages.forEach((page) => page.classList.toggle("active", page.id === pageId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("tombolLanjut").addEventListener("click", () => showPage("halamanMenu"));

document.querySelectorAll("[data-target]").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.target));
});

function cleanBinary(value) {
  return value.replace(/\s+/g, "");
}

function isBinary(value) {
  return /^[01]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function padBinary(value, width) {
  return value.toString(2).padStart(width, "0");
}

function showError(element, messages) {
  if (!messages.length) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  element.hidden = false;
  element.innerHTML = messages.map((message) => `• ${escapeHtml(message)}`).join("<br>");
}

function resultRow(label, value) {
  return `
    <div class="result-row">
      <div class="result-label">${escapeHtml(label)}</div>
      <div class="result-value">${escapeHtml(value)}</div>
    </div>`;
}

function resultGroup(title, rows) {
  return `<section class="result-group"><h4>${escapeHtml(title)}</h4>${rows.join("")}</section>`;
}

function statusBadge(type, text) {
  return `<span class="status ${type}">${escapeHtml(text)}</span>`;
}

// ---------------- CHECKSUM ----------------

const jumlahBlokChecksum = document.getElementById("jumlahBlokChecksum");
const panjangBlokChecksum = document.getElementById("panjangBlokChecksum");
const daftarInputChecksum = document.getElementById("daftarInputChecksum");
const formChecksum = document.getElementById("formChecksum");
const errorChecksum = document.getElementById("errorChecksum");
const hasilChecksum = document.getElementById("hasilChecksum");

function createChecksumInputs() {
  const count = Number(jumlahBlokChecksum.value);
  const width = Number(panjangBlokChecksum.value);
  const safeCount = Number.isInteger(count) ? Math.min(Math.max(count, 2), 20) : 2;
  const safeWidth = Number.isInteger(width) ? Math.min(Math.max(width, 1), 128) : 8;

  jumlahBlokChecksum.value = safeCount;
  panjangBlokChecksum.value = safeWidth;
  daftarInputChecksum.innerHTML = "";

  const examples = ["10101010", "01010101", "11001100"];

  for (let index = 0; index < safeCount; index += 1) {
    const label = document.createElement("label");
    label.className = "field";
    const example = safeWidth === 8 && examples[index] ? examples[index] : "";
    label.innerHTML = `
      <span>Data Tx blok ${index + 1}</span>
      <input class="checksum-block" type="text" maxlength="${safeWidth}" value="${example}" placeholder="${"0".repeat(Math.min(safeWidth, 24))}" autocomplete="off" spellcheck="false">`;
    daftarInputChecksum.appendChild(label);
  }

  document.getElementById("checksumTxInput").maxLength = safeWidth;
}

document.getElementById("buatKolomChecksum").addEventListener("click", createChecksumInputs);
createChecksumInputs();

function onesComplementSum(binaryBlocks, width) {
  const widthBigInt = BigInt(width);
  const mask = (1n << widthBigInt) - 1n;
  const values = binaryBlocks.map((block) => BigInt(`0b${block}`));
  const rawTotal = values.reduce((sum, value) => sum + value, 0n);
  let folded = rawTotal;
  const carrySteps = [];

  while (folded > mask) {
    const lower = folded & mask;
    const carry = folded >> widthBigInt;
    folded = lower + carry;
    carrySteps.push({ lower, carry, result: folded });
  }

  return { rawTotal, folded, mask, carrySteps };
}

formChecksum.addEventListener("submit", (event) => {
  event.preventDefault();

  const width = Number(panjangBlokChecksum.value);
  const count = Number(jumlahBlokChecksum.value);
  const blockInputs = [...document.querySelectorAll(".checksum-block")];
  const blocks = blockInputs.map((input) => cleanBinary(input.value));
  const checksumInput = cleanBinary(document.getElementById("checksumTxInput").value);
  let rx = cleanBinary(document.getElementById("dataRxChecksum").value);
  const errors = [];

  if (!Number.isInteger(count) || count < 2 || count > 20) {
    errors.push("Jumlah blok harus antara 2 dan 20.");
  }
  if (!Number.isInteger(width) || width < 1 || width > 128) {
    errors.push("Panjang blok harus antara 1 dan 128 bit.");
  }
  if (blockInputs.length !== count) {
    errors.push("Buat ulang kolom data agar sesuai dengan jumlah blok.");
  }

  blocks.forEach((block, index) => {
    if (!isBinary(block)) {
      errors.push(`Data Tx blok ${index + 1} hanya boleh berisi 0 dan 1.`);
    } else if (block.length !== width) {
      errors.push(`Data Tx blok ${index + 1} harus tepat ${width} bit.`);
    }
  });

  if (checksumInput && (!isBinary(checksumInput) || checksumInput.length !== width)) {
    errors.push(`Checksum Tx harus berupa data biner sepanjang ${width} bit.`);
  }

  showError(errorChecksum, errors);
  if (errors.length) return;

  const txCalculation = onesComplementSum(blocks, width);
  const checksumCalculated = padBinary((~txCalculation.folded) & txCalculation.mask, width);
  const checksumUsed = checksumInput || checksumCalculated;
  const codeword = blocks.join("") + checksumUsed;

  if (!rx) {
    rx = codeword;
    document.getElementById("dataRxChecksum").value = rx;
  }

  const expectedRxLength = (count + 1) * width;
  if (!isBinary(rx)) {
    showError(errorChecksum, ["Data Rx hanya boleh berisi 0 dan 1."]);
    return;
  }
  if (rx.length !== expectedRxLength) {
    showError(errorChecksum, [`Panjang Data Rx harus ${expectedRxLength} bit, sama dengan codeword Tx.`]);
    return;
  }

  const rxBlocks = [];
  for (let index = 0; index < rx.length; index += width) {
    rxBlocks.push(rx.slice(index, index + width));
  }

  const rxCalculation = onesComplementSum(rxBlocks, width);
  const rxSum = padBinary(rxCalculation.folded, width);
  const valid = rxCalculation.folded === rxCalculation.mask;

  const carryDescription = txCalculation.carrySteps.length
    ? txCalculation.carrySteps.map((step, index) => {
        return `Langkah ${index + 1}: bagian bawah ${padBinary(step.lower, width)} + carry ${step.carry.toString(2)} = ${step.result.toString(2)}`;
      }).join("\n")
    : "Tidak ada carry.";

  hasilChecksum.className = "result-content";
  hasilChecksum.innerHTML = [
    resultGroup("Data Pengirim (Tx)", [
      resultRow("Data Tx", blocks.join(" | ")),
      resultRow("Panjang bit tiap data", `${width} bit`),
      resultRow("SUM Tx(tanpa carry) ", txCalculation.rawTotal.toString(2)),
      resultRow("SUM TX(dengan carry)", padBinary(txCalculation.folded, width)),
      resultRow("Checksum ", checksumCalculated),
      resultRow("Checksum Tx(otomatis/manual)", checksumUsed),
      resultRow("Data yang dikirim", codeword)
    ]),
    `<section class="result-group"><h4>Proses End-Around Carry</h4><pre class="code-box">${escapeHtml(carryDescription)}</pre></section>`,
    resultGroup("Pemeriksaan Penerima (Rx)", [
      resultRow("Data yang diterima (Rx)", rx),
      resultRow("Data Rx", rxBlocks.join(" | ")),
      resultRow("Check Rx", rxSum),
      `<div class="result-row"><div class="result-label">Status</div><div class="result-value">${statusBadge(valid ? "success" : "danger", valid ? "Tidak terdeteksi error" : "ERROR • Hasil sum bukan seluruh bit 1")}</div></div>`
    ])
  ].join("");
});

// ---------------- CRC ----------------

const formCRC = document.getElementById("formCRC");
const errorCRC = document.getElementById("errorCRC");
const hasilCRC = document.getElementById("hasilCRC");

function modulo2Division(dividend, divisor) {
  const working = dividend.split("");
  const steps = [];
  const limit = dividend.length - divisor.length;

  for (let index = 0; index <= limit; index += 1) {
    if (working[index] !== "1") continue;

    const before = working.slice(index, index + divisor.length).join("");
    for (let offset = 0; offset < divisor.length; offset += 1) {
      working[index + offset] = working[index + offset] === divisor[offset] ? "0" : "1";
    }
    const after = working.slice(index, index + divisor.length).join("");
    steps.push({ index, before, divisor, after, current: working.join("") });
  }

  const degree = divisor.length - 1;
  const remainder = degree > 0 ? working.slice(-degree).join("") : "";
  return { remainder, steps, finalState: working.join("") };
}

formCRC.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = cleanBinary(document.getElementById("dataTxCRC").value);
  const generator = cleanBinary(document.getElementById("generatorCRC").value);
  const fcsInput = cleanBinary(document.getElementById("fcsCRCInput").value);
  let rx = cleanBinary(document.getElementById("dataRxCRC").value);
  const errors = [];

  if (!isBinary(data)) errors.push("Data Tx asli hanya boleh berisi 0 dan 1.");
  if (!isBinary(generator)) errors.push("Generator polynomial hanya boleh berisi 0 dan 1.");
  if (generator.length < 2) errors.push("Generator polynomial minimal terdiri atas dua bit.");
  if (generator && (generator[0] !== "1" || generator.at(-1) !== "1")) {
    errors.push("Bit pertama dan bit terakhir generator harus bernilai 1.");
  }

  const degree = Math.max(generator.length - 1, 0);
  if (fcsInput && (!isBinary(fcsInput) || fcsInput.length !== degree)) {
    errors.push(`FCS/CRC Tx harus berupa data biner sepanjang ${degree} bit.`);
  }

  showError(errorCRC, errors);
  if (errors.length) return;

  const augmented = data + "0".repeat(degree);
  const txDivision = modulo2Division(augmented, generator);
  const fcsCalculated = txDivision.remainder.padStart(degree, "0");
  const fcsUsed = fcsInput || fcsCalculated;
  const codeword = data + fcsUsed;

  if (!rx) {
    rx = codeword;
    document.getElementById("dataRxCRC").value = rx;
  }

  if (!isBinary(rx)) {
    showError(errorCRC, ["Data Rx hanya boleh berisi 0 dan 1."]);
    return;
  }
  if (rx.length !== codeword.length) {
    showError(errorCRC, [`Panjang Data Rx harus ${codeword.length} bit, sama dengan codeword Tx.`]);
    return;
  }

  const rxDivision = modulo2Division(rx, generator);
  const rxRemainder = rxDivision.remainder.padStart(degree, "0");
  const valid = /^0+$/.test(rxRemainder);

  const maxSteps = 180;
  const visibleSteps = txDivision.steps.slice(0, maxSteps);
  const stepText = visibleSteps.length
    ? visibleSteps.map((step, index) => {
        return [
          `Langkah ${index + 1} • posisi ${step.index + 1}`,
          `  ${step.before}`,
          `⊕ ${step.divisor}`,
          `= ${step.after}`,
          `  Keadaan data: ${step.current}`
        ].join("\n");
      }).join("\n\n")
    : "Tidak ada operasi XOR karena tidak ditemukan bit utama 1 pada rentang pembagian.";

  const truncatedNote = txDivision.steps.length > maxSteps
    ? `\n\nDitampilkan ${maxSteps} dari ${txDivision.steps.length} langkah agar browser tidak ikut mengalami krisis.`
    : "";

  hasilCRC.className = "result-content";
  hasilCRC.innerHTML = [
    resultGroup("Data Pengirim (Tx)", [
      resultRow("Data Tx", data),
      resultRow("Pola", generator),
      resultRow("Panjang FCS", String(degree)),
      resultRow("Data + bit nol", augmented),
      resultRow("Remainder Tx", txDivision.remainder),
      resultRow("FCS/CRC", fcsCalculated),
      resultRow("FCS/CRC(manual/otomatis)", fcsUsed),
      resultRow("Data yang dikirim (Tx)", codeword)
    ]),
    `<section class="result-group"><h4>Tahapan Pembagian Modulo-2</h4><pre class="code-box">${escapeHtml(stepText + truncatedNote)}</pre></section>`,
    resultGroup("Pemeriksaan Penerima (Rx)", [
      resultRow("Data Rx", rx),
      resultRow("Remainder Rx", rxRemainder),
      `<div class="result-row"><div class="result-label">Status</div><div class="result-value">${statusBadge(valid ? "success" : "danger", valid ? "Tidak ada error,Remainder seluruhnya nol" : "ERROR • Remainder mengandung bit 1")}</div></div>`
    ]),
    `<div class="note">CRC mendeteksi perubahan melalui remainder, tetapi tidak menunjukkan atau memperbaiki posisi bit yang rusak.</div>`
  ].join("");
});

// ---------------- HAMMING CODE ----------------

const formHamming = document.getElementById("formHamming");
const errorHamming = document.getElementById("errorHamming");
const hasilHamming = document.getElementById("hasilHamming");

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function calculateParityCount(dataBitCount) {
  let parityCount = 0;
  while (2 ** parityCount < dataBitCount + parityCount + 1) parityCount += 1;
  return parityCount;
}

function buildHammingCode(data) {
  const dataCount = data.length;
  const parityCount = calculateParityCount(dataCount);
  const totalLength = dataCount + parityCount;
  const bits = Array(totalLength + 1).fill("0");
  const dataPositions = [];
  let dataIndex = 0;

  for (let position = 1; position <= totalLength; position += 1) {
    if (!isPowerOfTwo(position)) {
      bits[position] = data[dataIndex];
      dataPositions.push(position);
      dataIndex += 1;
    }
  }

  const parityDetails = [];
  for (let parityPosition = 1; parityPosition <= totalLength; parityPosition *= 2) {
    let parity = 0;
    const coveredPositions = [];

    for (let position = 1; position <= totalLength; position += 1) {
      if ((position & parityPosition) !== 0 && position !== parityPosition) {
        parity ^= Number(bits[position]);
        coveredPositions.push(position);
      }
    }

    bits[parityPosition] = String(parity);
    parityDetails.push({ parityPosition, coveredPositions, value: parity });
  }

  return {
    dataCount,
    parityCount,
    totalLength,
    bits,
    codeword: bits.slice(1).join(""),
    dataPositions,
    parityDetails
  };
}

function inspectHamming(received) {
  const totalLength = received.length;
  const bits = ["", ...received.split("")];
  const parityPositions = [];
  let syndromeValue = 0;

  for (let parityPosition = 1; parityPosition <= totalLength; parityPosition *= 2) {
    let parity = 0;
    for (let position = 1; position <= totalLength; position += 1) {
      if ((position & parityPosition) !== 0) parity ^= Number(bits[position]);
    }
    parityPositions.push({ parityPosition, check: parity });
    if (parity === 1) syndromeValue += parityPosition;
  }

  const syndromeWidth = parityPositions.length;
  const syndromeBinary = syndromeValue.toString(2).padStart(syndromeWidth, "0");
  const correctedBits = [...bits];
  let corrected = false;

  if (syndromeValue > 0 && syndromeValue <= totalLength) {
    correctedBits[syndromeValue] = correctedBits[syndromeValue] === "1" ? "0" : "1";
    corrected = true;
  }

  const correctedCodeword = correctedBits.slice(1).join("");
  const recoveredData = correctedBits
    .slice(1)
    .filter((_, index) => !isPowerOfTwo(index + 1))
    .join("");

  return {
    parityPositions,
    syndromeValue,
    syndromeBinary,
    corrected,
    correctedCodeword,
    recoveredData
  };
}

function positionGrid(codeword) {
  return `<div class="position-grid">${codeword.split("").map((bit, index) => {
    const position = index + 1;
    const label = isPowerOfTwo(position) ? `P${position}` : `D${position}`;
    return `<div class="position-cell"><strong>${label} • pos ${position}</strong><span>${bit}</span></div>`;
  }).join("")}</div>`;
}

formHamming.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = cleanBinary(document.getElementById("dataTxHamming").value);
  const codewordInput = cleanBinary(document.getElementById("codewordHammingInput").value);
  let rx = cleanBinary(document.getElementById("dataRxHamming").value);
  const errors = [];

  if (!isBinary(data)) errors.push("Data Tx asli minimal satu bit dan hanya boleh berisi 0 dan 1.");
  if (data.length > 256) errors.push("Data Tx dibatasi maksimal 256 bit agar tampilan tetap masuk akal.");

  showError(errorHamming, errors);
  if (errors.length) return;

  const generated = buildHammingCode(data);

  if (codewordInput && (!isBinary(codewordInput) || codewordInput.length !== generated.totalLength)) {
    showError(errorHamming, [`Hamming code Tx harus berupa data biner sepanjang ${generated.totalLength} bit.`]);
    return;
  }

  const codewordUsed = codewordInput || generated.codeword;

  if (!rx) {
    rx = codewordUsed;
    document.getElementById("dataRxHamming").value = rx;
  }

  if (!isBinary(rx)) {
    showError(errorHamming, ["Data Rx hanya boleh berisi 0 dan 1."]);
    return;
  }
  if (rx.length !== generated.totalLength) {
    showError(errorHamming, [`Panjang Data Rx harus ${generated.totalLength} bit.`]);
    return;
  }

  const inspection = inspectHamming(rx);
  const parityDescription = generated.parityDetails.map((detail) => {
    return `P${detail.parityPosition} memeriksa posisi ${detail.coveredPositions.join(", ")} → nilai paritas ${detail.value}`;
  }).join("\n");

  let statusType = "success";
  let statusText = "VALID • Syndrome 0, tidak terdeteksi error";
  let positionText = "Tidak ada";

  if (inspection.syndromeValue > 0 && inspection.syndromeValue <= generated.totalLength) {
    statusType = "warning";
    statusText = "TERDETEKSI • Satu bit dikoreksi berdasarkan syndrome";
    positionText = `Posisi ${inspection.syndromeValue}`;
  } else if (inspection.syndromeValue > generated.totalLength) {
    statusType = "danger";
    statusText = "TIDAK DAPAT DIKOREKSI • Syndrome di luar panjang codeword";
    positionText = `Syndrome menunjuk posisi ${inspection.syndromeValue}`;
  }

  hasilHamming.className = "result-content";
  hasilHamming.innerHTML = [
    resultGroup("Data Pengirim (Tx)", [
      resultRow("Data Tx asli", data),
      resultRow("Jumlah bit data (m)", String(generated.dataCount)),
      resultRow("Jumlah bit paritas (r)", String(generated.parityCount)),
      resultRow("Panjang codeword", `${generated.totalLength} bit`),
      resultRow("Posisi bit data", generated.dataPositions.join(", ")),
      resultRow("Hamming code hasil sistem", generated.codeword),
      resultRow("Hamming code Tx digunakan", codewordUsed)
    ]),
    `<section class="result-group"><h4>Susunan Posisi Codeword</h4>${positionGrid(codewordUsed)}</section>`,
    `<section class="result-group"><h4>Perhitungan Paritas Genap</h4><pre class="code-box">${escapeHtml(parityDescription)}</pre></section>`,
    resultGroup("Pemeriksaan dan Koreksi Rx", [
      resultRow("Data Rx", rx),
      resultRow("Syndrome biner", inspection.syndromeBinary),
      resultRow("Syndrome desimal", String(inspection.syndromeValue)),
      resultRow("Posisi bit error", positionText),
      resultRow("Codeword setelah koreksi", inspection.correctedCodeword),
      resultRow("Data asli setelah koreksi", inspection.recoveredData),
      `<div class="result-row"><div class="result-label">Status</div><div class="result-value">${statusBadge(statusType, statusText)}</div></div>`
    ]),
    `<div class="note">Hamming Code standar mengasumsikan maksimal satu bit error. Pada error lebih dari satu bit, syndrome dapat menunjuk posisi yang keliru dan koreksi tidak selalu benar.</div>`
  ].join("");
});
