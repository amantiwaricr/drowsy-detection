"""Train the drowsiness model from dataset/awake and dataset/drowsy.

The images should be EYE crops (the backend feeds the model eye crops):
    dataset/awake/   open-eye images
    dataset/drowsy/  closed-eye images

Usage (from the backend folder):
    python train.py
    python train.py --epochs 20 --img-size 64

Saves model/drowsiness_model.h5 and prints accuracy on a held-out
validation split. Report that measured number, never an assumed one.
"""

import argparse
import os

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import tensorflow as tf
from tensorflow import keras

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CLASSES = ["awake", "drowsy"]  # label 0 = awake, label 1 = drowsy


def load_datasets(dataset_dir, img_size, batch_size):
    common = dict(
        labels="inferred",
        label_mode="binary",
        class_names=CLASSES,
        color_mode="grayscale",
        image_size=(img_size, img_size),
        batch_size=batch_size,
        validation_split=0.2,
        seed=42,
    )
    train = keras.utils.image_dataset_from_directory(dataset_dir, subset="training", **common)
    val = keras.utils.image_dataset_from_directory(dataset_dir, subset="validation", **common)

    augment = keras.Sequential([
        keras.layers.RandomFlip("horizontal"),
        keras.layers.RandomRotation(0.05),
        keras.layers.RandomContrast(0.2),
    ])
    # Scale to [0, 1] here, matching detection.preprocess_eye().
    train = train.map(lambda x, y: (augment(x / 255.0, training=True), y))
    val = val.map(lambda x, y: (x / 255.0, y))
    return train.prefetch(tf.data.AUTOTUNE), val.prefetch(tf.data.AUTOTUNE)


def build_model(img_size):
    model = keras.Sequential([
        keras.Input((img_size, img_size, 1)),
        keras.layers.Conv2D(32, 3, activation="relu"),
        keras.layers.MaxPooling2D(),
        keras.layers.Conv2D(64, 3, activation="relu"),
        keras.layers.MaxPooling2D(),
        keras.layers.Conv2D(128, 3, activation="relu"),
        keras.layers.MaxPooling2D(),
        keras.layers.Flatten(),
        keras.layers.Dropout(0.5),
        keras.layers.Dense(64, activation="relu"),
        keras.layers.Dense(1, activation="sigmoid"),  # P(drowsy)
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def main():
    parser = argparse.ArgumentParser(description="Train the DrowzyGuard drowsiness model.")
    parser.add_argument("--dataset", default=os.path.join(ROOT, "dataset"))
    parser.add_argument("--output", default=os.path.join(ROOT, "model", "drowsiness_model.h5"))
    parser.add_argument("--img-size", type=int, default=64)
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    train, val = load_datasets(args.dataset, args.img_size, args.batch_size)
    model = build_model(args.img_size)
    model.fit(
        train,
        validation_data=val,
        epochs=args.epochs,
        callbacks=[keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True)],
    )

    loss, accuracy = model.evaluate(val, verbose=0)
    print(f"\nValidation accuracy: {accuracy:.2%} (loss {loss:.4f}) on held-out images")

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    model.save(args.output)
    print(f"Saved model to {os.path.normpath(args.output)}")


if __name__ == "__main__":
    main()
