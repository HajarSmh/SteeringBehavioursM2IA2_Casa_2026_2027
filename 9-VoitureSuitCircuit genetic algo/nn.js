class NeuralNetwork {
  // new NeuralNetwork(nbEntrées, [tailles couches cachées], nbSorties)
  // ou new NeuralNetwork(modèleTF, nbEntrées, [couches cachées], nbSorties)
  constructor(a, b, c, d) {
    if (a instanceof tf.Sequential) {
      this.model = a;
      this.input_nodes = b;
      this.hidden = c;
      this.output_nodes = d;
    } else {
      this.input_nodes = a;
      this.hidden = b;
      this.output_nodes = c;
      this.model = this.createModel();
    }
  }

  copy() {
    return tf.tidy(() => {
      const modelCopy = this.createModel();
      modelCopy.setWeights(this.model.getWeights().map(w => w.clone()));
      return new NeuralNetwork(modelCopy, this.input_nodes, this.hidden, this.output_nodes);
    });
  }

  // Mutation des poids avec une probabilité "rate"
  mutate(rate) {
    tf.tidy(() => {
      const weights = this.model.getWeights();
      const mutated = [];
      for (let i = 0; i < weights.length; i++) {
        const shape = weights[i].shape;
        const values = weights[i].dataSync().slice();
        for (let j = 0; j < values.length; j++) {
          if (random(1) < rate) values[j] += randomGaussian();
        }
        mutated[i] = tf.tensor(values, shape);
      }
      this.model.setWeights(mutated);
    });
  }

  dispose() {
    this.model.dispose();
  }

  // Poids -> objet JSON-compatible
  serialize() {
    return this.model.getWeights().map(w => ({ shape: w.shape, data: Array.from(w.dataSync()) }));
  }

  static deserialize(inputs, hidden, outputs, data) {
    const nn = new NeuralNetwork(inputs, hidden, outputs);
    tf.tidy(() => nn.model.setWeights(data.map(w => tf.tensor(w.data, w.shape))));
    return nn;
  }

  predict(inputs) {
    return tf.tidy(() => this.model.predict(tf.tensor2d([inputs])).dataSync());
  }

  createModel() {
    const model = tf.sequential();
    this.hidden.forEach((units, i) => {
      const cfg = { units, activation: 'sigmoid' };
      if (i === 0) cfg.inputShape = [this.input_nodes];
      model.add(tf.layers.dense(cfg));
    });
    model.add(tf.layers.dense({ units: this.output_nodes, activation: 'sigmoid' }));
    return model;
  }
}