import { createInjector, inject, Injector } from 'static-injector';
import { GraphLocalService } from './graph.local.service';
import { GraphKnolwdgeService } from './graph.knowledge.service';
import { GraphHandleService } from './graph.handle.service';
import { GraphSplitNodeInput } from './type';
import {
  EdgeItemType,
  EdgePayload,
  KnowledgeGraphItemType,
  NodeItemType,
} from './define/define';
import { GraphQueryService } from './graph.query.service';
import { QueryParams, QueryParamsToken } from './const';

export class GraphService {
  local = inject(GraphLocalService);
  #knowledge = inject(GraphHandleService);
  knowledge = inject(GraphKnolwdgeService);
  #injector = inject(Injector);
  graphExport$$ = this.local.graphExport$$;
  createQuery(queryParams: QueryParams) {
    return createInjector({
      providers: [
        GraphQueryService,
        { provide: QueryParamsToken, useValue: queryParams },
      ],
      parent: this.#injector,
    }).get(GraphQueryService);
  }
  loadDataInit$$ = this.local.loadDataInitGraph$$;
  initGraph() {
    return this.local.initGraph();
  }
  getGraph() {
    return this.local.getGraph();
  }
  async splitNode(options: GraphSplitNodeInput) {
    await this.local.splitNode(options);
    await this.#knowledge.splitNode(options);
  }
  async mergeNode(options: GraphSplitNodeInput) {
    await this.local.mergeNode(options);
    await this.#knowledge.mergeNode(options);
  }
  async changeNodeDescription(item: NodeItemType) {
    await this.local.changeNodeDescription(item);
    await this.#knowledge.changeNodeDescription(item);
  }
  async changeEdge(
    item: EdgeItemType,
    oldItem: Pick<EdgePayload, 'id' | 'source' | 'target'>,
  ) {
    await this.local.changeEdge(item, oldItem);
    await this.#knowledge.changeEdge(item);
  }
  async add(input: KnowledgeGraphItemType) {
    await this.local.add(input);
    await this.#knowledge.addNodeItem(input);
  }
  async deleteNodeItem(item: Pick<NodeItemType, 'id' | 'name'>) {
    await this.local.deleteNodeItem(item);
    await this.#knowledge.deleteNodeItem(item);
  }
  async deleteEdge(item: Pick<EdgeItemType, 'id' | 'source' | 'target'>) {
    await this.local.deleteEdgeItem(item);
    await this.#knowledge.deleteEdge(item);
  }
  async deleteNodeByName(name: string) {
    await this.local.deleteNode(name);
    await this.#knowledge.deleteNodeByName(name);
  }
}
