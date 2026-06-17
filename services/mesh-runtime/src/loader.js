import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class MeshLoader {
  constructor(meshRoot) {
    this.root = meshRoot;
  }

  async loadWorkflowIndex() {
    const indexPath = path.join(this.root, 'workflows', 'index.yaml');
    return yaml.load(fs.readFileSync(indexPath, 'utf8'));
  }

  async loadWorkflow(id) {
    const index = await this.loadWorkflowIndex();
    const entry = index.workflows.find(w => w.id === id);
    if (!entry) throw new Error(`Workflow not found: ${id}`);
    const filePath = path.join(this.root, entry.file);
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  }

  async loadAgentIndex() {
    const indexPath = path.join(this.root, 'agents', 'index.yaml');
    return yaml.load(fs.readFileSync(indexPath, 'utf8'));
  }

  async loadAgent(id) {
    const index = await this.loadAgentIndex();
    const entry = index.agents.find(a => a.id === id);
    if (!entry) throw new Error(`Agent not found: ${id}`);
    const filePath = path.join(this.root, entry.file);
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  }

  async loadProfileIndex() {
    const indexPath = path.join(this.root, 'profiles', 'index.yaml');
    return yaml.load(fs.readFileSync(indexPath, 'utf8'));
  }

  async loadProfile(id) {
    const index = await this.loadProfileIndex();
    const entry = index.profiles.find(p => p.id === id);
    if (!entry) throw new Error(`Profile not found: ${id}`);
    const filePath = path.join(this.root, entry.file);
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  }

  async loadRetrievalIndex() {
    const indexPath = path.join(this.root, 'retrieval', 'index.yaml');
    return yaml.load(fs.readFileSync(indexPath, 'utf8'));
  }

  async loadRetrieval(id) {
    const index = await this.loadRetrievalIndex();
    const entry = index.configs.find(c => c.id === id);
    if (!entry) throw new Error(`Retrieval config not found: ${id}`);
    const filePath = path.join(this.root, entry.file);
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  }
}
