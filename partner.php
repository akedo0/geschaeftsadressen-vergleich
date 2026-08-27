<?php
/**
 * Empfaenger fuer das Partner-Formular (Anbieter-Bewerbung).
 *
 * Bewusst ohne Framework, ohne Datenbank und ohne Drittanbieter: Die
 * Angaben gehen ausschliesslich per E-Mail an das eigene Postfach und
 * werden nirgends gespeichert. Damit bleibt die Seite cookie- und
 * trackingfrei.
 *
 * Antwortet mit JSON, wenn per fetch gesendet wurde, sonst mit einem
 * Redirect zurueck auf die Seite (Formular funktioniert ohne JavaScript).
 */

declare(strict_types=1);

const EMPFAENGER   = 'kontakt@geschaeftsadressen-vergleich.de';
const ABSENDER     = 'noreply@geschaeftsadressen-vergleich.de';
const ZURUECK_SEITE = '/index.html';
const ZURUECK_ANKER = '#partner';
const MAX_FELDLAENGE = 2000;

/** Erwartet der Aufrufer JSON (fetch) oder einen Redirect (klassisches POST)? */
function willJson(): bool
{
    $requestedWith = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    $accept        = $_SERVER['HTTP_ACCEPT'] ?? '';
    return $requestedWith === 'fetch' || str_contains($accept, 'application/json');
}

function antworten(bool $ok, string $fehler = ''): never
{
    if (willJson()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($ok ? 200 : 400);
        echo json_encode(['ok' => $ok, 'error' => $fehler], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Query MUSS vor dem Fragment stehen, sonst landet "?gesendet=1" im Anker.
    $ziel = ZURUECK_SEITE . ($ok ? '?gesendet=1' : '?fehler=1') . ZURUECK_ANKER;
    header('Location: ' . $ziel, true, 303);
    exit;
}

/** Schneidet Steuerzeichen und Zeilenumbrueche weg (Header-Injection). */
function saeubern(string $wert, bool $einzeilig = true): string
{
    $wert = trim($wert);
    $wert = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $wert) ?? '';
    if ($einzeilig) {
        $wert = str_replace(["\r", "\n"], ' ', $wert);
    }
    return mb_substr($wert, 0, MAX_FELDLAENGE);
}

function feld(string $name, bool $einzeilig = true): string
{
    return saeubern((string) ($_POST[$name] ?? ''), $einzeilig);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    antworten(false, 'Ungueltige Anfrage.');
}

// Honeypot: echte Anbieter fuellen dieses Feld nie aus. Wir antworten
// bewusst mit "ok", damit Bots keinen Fehler zum Auswerten bekommen.
if (feld('website2') !== '') {
    antworten(true);
}

$firma      = feld('firma');
$website    = feld('website');
$name       = feld('name');
$email      = feld('email');
$preis      = feld('preis');
$standorte  = feld('standorte');
$hrNutzung  = feld('handelsregister');
$scans      = feld('scans');
$kuendigung = feld('kuendigung');
$nachricht  = feld('nachricht', false);

if ($firma === '' || $website === '' || $name === '' || $email === '' || $preis === '' || $standorte === '') {
    antworten(false, 'Bitte fuellen Sie alle Pflichtfelder aus.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    antworten(false, 'Bitte pruefen Sie Ihre E-Mail-Adresse.');
}
if (!filter_var($website, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $website)) {
    antworten(false, 'Bitte geben Sie die Website inklusive https:// an.');
}
if (($_POST['bestaetigung'] ?? '') === '' || ($_POST['datenschutz'] ?? '') === '') {
    antworten(false, 'Bitte bestaetigen Sie die beiden Haekchen.');
}

$zeilen = [
    'Anbieter / Firma : ' . $firma,
    'Website          : ' . $website,
    'Ansprechpartner  : ' . $name,
    'E-Mail           : ' . $email,
    'Preis ab         : ' . $preis,
    'Standorte        : ' . $standorte,
    'Handelsregister  : ' . ($hrNutzung !== '' ? $hrNutzung : '-'),
    'Post-Scans       : ' . ($scans !== '' ? $scans : '-'),
    'Kuendigung       : ' . ($kuendigung !== '' ? $kuendigung : '-'),
    '',
    'Nachricht:',
    $nachricht !== '' ? $nachricht : '-',
    '',
    'Eingegangen: ' . gmdate('d.m.Y H:i') . ' UTC',
];

$betreff = '=?UTF-8?B?' . base64_encode('Anbieter-Anfrage: ' . $firma) . '?=';
$kopf = implode("\r\n", [
    'From: Vergleich Formular <' . ABSENDER . '>',
    'Reply-To: ' . $email,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: geschaeftsadressen-vergleich.de',
]);

$gesendet = @mail(EMPFAENGER, $betreff, implode("\r\n", $zeilen), $kopf);

antworten($gesendet, $gesendet ? '' : 'Der Versand hat nicht geklappt. Bitte schreiben Sie uns direkt an ' . EMPFAENGER . '.');
