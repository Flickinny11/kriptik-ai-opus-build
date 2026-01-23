
#!/bin/bash
set -e

cd /workspace/SimpleTuner

# Extract dataset if needed
if [ -f "/workspace/dataset.tar.gz" ]; then
  tar -xzf /workspace/dataset.tar.gz -C /workspace/
fi

# Run training
accelerate launch \
  --mixed_precision=bf16 \
  --num_processes=1 \
  train.py \
  --config /workspace/simpletuner_config.toml

# Save final model
if [ -f "/workspace/output/pytorch_lora_weights.safetensors" ]; then
  cp /workspace/output/pytorch_lora_weights.safetensors /workspace/kriptik-ui-design-lora.safetensors
  echo "✅ Training complete! Model saved to /workspace/kriptik-ui-design-lora.safetensors"
fi
