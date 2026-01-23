
#!/bin/bash
set -e

cd /workspace

# Clone SimpleTuner if not present
if [ ! -d "SimpleTuner" ]; then
  git clone https://github.com/bghira/SimpleTuner.git
fi

cd SimpleTuner

# Install dependencies
pip install -r requirements.txt
pip install accelerate transformers diffusers peft safetensors
pip install bitsandbytes scipy

# Install FLUX-specific dependencies
pip install einops

echo "✅ Dependencies installed"
