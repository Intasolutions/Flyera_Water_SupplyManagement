import os
import sys
import subprocess

# Auto-redirect to local venv python if running with system python
backend_dir = os.path.dirname(os.path.abspath(__file__))
venv_python = os.path.join(backend_dir, "venv", "Scripts", "python.exe")

if os.path.exists(venv_python) and os.path.abspath(sys.executable).lower() != os.path.abspath(venv_python).lower():
    print(f"[Flyera Backend] Automatically switching to virtualenv: {venv_python}")
    sys.exit(subprocess.call([venv_python, os.path.abspath(__file__)] + sys.argv[1:]))

if __name__ == "__main__":
    port = 8000
    host = "127.0.0.1"

    # Support optional port argument e.g. python manage.py runserver 8000
    for arg in sys.argv[1:]:
        if arg.isdigit():
            port = int(arg)
        elif ":" in arg:
            parts = arg.split(":")
            host = parts[0] or host
            if parts[1].isdigit():
                port = int(parts[1])

    try:
        import uvicorn
    except ImportError:
        print("uvicorn is not installed in this environment. Please run: pip install -r requirements.txt")
        sys.exit(1)

    print(f"[Flyera Backend] Starting FastAPI server on http://{host}:{port} with auto-reload...")
    uvicorn.run("main:app", host=host, port=port, reload=True)

