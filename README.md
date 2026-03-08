# IT Memory Online

Ein interaktives Memory-Spiel mit Multiplayer-Unterstützung, entwickelt mit Angular im Frontend und FastAPI im Backend.

## Features

- **Einzelspielermodus**: Spielen Sie gegen die Uhr und verbessern Sie Ihre Bestzeiten
- **Multiplayermodus**: Spielen Sie live gegen andere Spieler mit automatischem Matchmaking
- **Mehrere Schwierigkeitsstufen**: Wählen Sie zwischen verschiedenen Spielfeldgrößen und Schwierigkeitsstufen
- **Echtzeit-Spielsitzungen**: Live-Updates und Synchronisation zwischen Spielern
- **Scoreboard**: Verfolgen Sie Ihre Erfolge und Spielstatistiken
- **Responsive Design**: Optimierte Benutzeroberfläche für verschiedene Bildschirmgrößen

## Projektstruktur

```
IT_Memory_Online/
├── backend/                    # FastAPI-Backend
│   ├── main.py                # Hauptanwendung und REST-API
│   ├── config.py              # Konfiguration (CORS, API-Einstellungen)
│   ├── models.py              # Datenmodelle
│   ├── utils.py               # Hilfsmodule
│   └── services/              # Geschäftslogik
│       ├── bot.py             # KI-Gegner für Einzelspielermodus
│       ├── matchmaker.py      # Spieler-Matching-System
│       ├── game_session.py    # Spielsitzungsverwaltung
│       └── session_manager.py # Session-Management
│
├── frontend/                  # Angular-Anwendung
│   ├── src/
│   │   ├── app/              # Angular-Komponenten
│   │   │   ├── mode-selection/    # Spielmodus-Auswahl
│   │   │   │   ├── menu/           # Hauptmenü
│   │   │   │   ├── game/           # Spielkomponente
│   │   │   │   ├── board/          # Spielfeld
│   │   │   │   ├── scoreboard/     # Score-Anzeige
│   │   │   │   └── match-found-dialog/
│   │   │   └── shared/             # Gemeinsame Services
│   │   ├── assets/           # Bilder und Icons
│   │   └── environments/     # Umgebungskonfiguration
│   └── package.json          # Abhängigkeiten
│
└── documentation/            # Projektdokumentation
```

## Anforderungen

### Software

- **Node.js**: Version 18.x oder höher (für Frontend)
- **npm**: Version 9.x oder höher (wird mit Node.js installiert)
- **Python**: Version 3.9 oder höher (für Backend)
- **pip**: Python Package Manager (wird mit Python installiert)

### Optionale Tools

- **Git**: Zum Klonen des Repositories
- **Visual Studio Code**: Empfohlener Code-Editor

## Installation und Starten

### Schritt 1: Repository klonen

```bash
git clone https://github.com/yourusername/IT_Memory_Online.git
cd IT_Memory_Online
```

### Schritt 2: Backend einrichten und starten

```bash
# In den Backend-Ordner wechseln
cd backend

# Virtuelle Python-Umgebung erstellen (optional, aber empfohlen)
python -m venv venv

# Virtuelle Umgebung aktivieren
# Unter Windows:
venv\Scripts\activate
# Unter macOS/Linux:
source venv/bin/activate

# Abhängigkeiten installieren
pip install fastapi uvicorn python-multipart

# Backend starten (läuft auf http://localhost:8000)
uvicorn main:app --reload
```

Das Backend stellt die REST-API bereit und läuft standardmäßig auf `http://localhost:8000`.

### Schritt 3: Frontend einrichten und starten

In einem **neuen Terminal**:

```bash
# In den Frontend-Ordner wechseln
cd frontend

# Abhängigkeiten installieren
npm install

# Frontend starten (läuft auf http://localhost:4200)
npm start
```

Die Anwendung öffnet sich automatisch im Browser unter `http://localhost:4200`.

## Verwendung

1. Öffnen Sie `http://localhost:4200` im Browser
2. Wählen Sie einen Spielmodus:
   - **Einzelspielermodus**: Spielen Sie gegen die Zeit
   - **Multiplayermodus**: Treten Sie einer Warteschlange bei und spielen Sie gegen einen anderen Spieler
3. Wählen Sie die Spielfeldgröße und Schwierigkeit
4. Klicken Sie auf die Karten, um Paare zu finden
5. Nach Spielende werden Ihre Ergebnisse auf dem Scoreboard angezeigt

## Architektur

### Backend (FastAPI)

- RESTful API für Spiellogik
- Matchmaking-System für Multiplayer-Spiele
- Session-Management für Spielsitzungen
- CORS-Middleware für Frontend-Integration

### Frontend (Angular)

- Component-basierte Architektur
- Services für Kommunikation mit dem Backend
- Bootstrap für responsive Design
- TypeScript für typsichere Entwicklung

## Datenaustausch

Der Datenaustausch zwischen Frontend und Backend erfolgt über HTTP-Requests:

- Frontend sendet Spielzüge und Anfragen an das Backend
- Backend verarbeitet die Logik und gibt Ergebnisse zurück
- Multiplayer-Sessions werden auf dem Backend synchronisiert

## Troubleshooting

### Backend startet nicht

- Überprüfen Sie, ob Python 3.9+ installiert ist: `python --version`
- Überprüfen Sie, ob alle Abhängigkeiten installiert sind: `pip list`
- Port 8000 ist belegt: Ändern Sie den Port mit `uvicorn main:app --reload --port 8001`

### Frontend startet nicht

- Überprüfen Sie, ob Node.js installiert ist: `node --version`
- Löschen Sie `node_modules` und `package-lock.json` und führen Sie `npm install` erneut aus
- Port 4200 ist belegt: Angular nutzt automatisch den nächsten verfügbaren Port

### Verbindung zwischen Frontend und Backend schlägt fehl

- Stellen Sie sicher, dass das Backend auf `http://localhost:8000` läuft
- Überprüfen Sie die CORS-Konfiguration in `backend/config.py`
- Überprüfen Sie die Backend-URL in `frontend/src/environments/environment.ts`

## Lizenz

Dieses Projekt ist lizenziert unter der MIT License.

## Kontakt

Für Fragen oder Suggestions kontaktieren Sie den Projektverantwortlichen.
