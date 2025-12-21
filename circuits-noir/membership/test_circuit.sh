#!/bin/bash

# Test script for the membership circuit
# This script compiles the circuit, runs tests, and generates a proof

set -e

echo "Setting up Noir environment..."
export PATH="$HOME/.nargo/bin:$PATH"

echo "Checking circuit for compilation errors..."
nargo check

echo "Running circuit tests..."
nargo test

echo "Compiling circuit..."
nargo compile

echo "Generating proof..."
nargo prove

echo "Verifying proof..."
nargo verify

echo "All tests passed successfully!"
