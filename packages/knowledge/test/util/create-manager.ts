import {
  computed,
  createRootInjector,
  Provider,
  R3Injector,
  Signal,
  signal,
  WritableSignal,
} from 'static-injector';
import { KnowledgeManagerService } from '../../knowledge.manager.service';
import {
  KnowledgeCollection,
  KnowledgeConfig,
  KnowledgeConfigInput,
  Log,
  OCR,
  Text2Vec,
  TextSplitter,
} from '../../type';
import { EntityExtractType } from '../../graph/define/define';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

import * as v from 'valibot';
import { KnowledgeConfigDefine } from '../../define';
import {
  DirToken,
  OCRToken,
  ReRankerToken,
  Text2VecToken,
  TextSplitterToken,
} from '../../const';
import { getTempDir } from '../../../util/test/util/tempdir';
import { LogToken, withResolvers } from '@shenghuabi/knowledge/util';
import { ContentParserFn, ContentParserToken } from '../../graph/const';
import path from 'path';
import { QdrantOptionsToken, QdrantStartToken } from '@shenghuabi/knowledge/qdrant';
import { expect } from 'chai';
type EnvConfig = {
  textSplitter: TextSplitter;
  text2Vec: Text2Vec;
  ocr: OCR;
  log: Log;
  contentParser?: ContentParserFn;
};
export async function createManager(envConfig?: Partial<EnvConfig>) {
  const dir = await getTempDir();

  // const tempToken = new InjectionToken<string>('');
  const collectionSizeMap: Record<string, number> = {
    collection2: 200,
  };
  const service = class TestKnowledgeManagerService extends KnowledgeManagerService {
    tempDir = dir;
    map = new Map<string, WritableSignal<KnowledgeConfig>>();
    addConfig(config: KnowledgeConfigInput) {
      const resolved = v.parse(KnowledgeConfigDefine, config);
      this.map.set(config.name, signal(resolved));
    }
    protected override getInjector(
      name: string,
      extraProviders?: Provider[],
    ): Promise<R3Injector> {
      const config = this.map.get(name)!;
      if (config().type === 'article') {
        return super.getInjector(name, [
          {
            provide: DirToken,
            useValue: signal(
              path.join(process.cwd(), './packages/knowledge/test/fixture'),
            ),
          },
        ]);
      }
      return super.getInjector(name, [
        { provide: DirToken, useValue: signal(path.join(dir, name)) },
      ]);
    }
    // override async setConfig(config: KnowledgeConfigInput): Promise<void> {
    //   this.map.set(config.name, config);
    // }
    override async getConfig(name: string): Promise<Signal<KnowledgeConfig>> {
      return computed(() =>
        v.parse(KnowledgeConfigDefine, this.map.get(name)!()!),
      );
    }

    override async create(
      name: string,
      collection: KnowledgeCollection,
    ): Promise<void> {
      await super.create(name, collection);
      const config = this.map.get(name)!;
      config.update((item) => {
        item.collectionList.push(collection as any);
        item.activateCollection = collection.collectionName;
        return { ...item };
      });
      this.map.set(name, config);
    }
    override async addCollection(
      name: string,
      collection: KnowledgeCollection,
    ): Promise<void> {
      await super.addCollection(name, collection);
      const config = this.map.get(name)!;
      config.update((item) => {
        item = { ...item };
        item.collectionList.push(collection as any);
        item.activateCollection = collection.collectionName;
        return item;
      });
      this.map.set(name, config);
    }
    override async deleteCollection(name: string, collectionName: string) {
      const result = await super.deleteCollection(name, collectionName);
      if (result) {
        const config = this.map.get(name)!;
        config.update((config) => {
          const index = config.collectionList.findIndex(
            (item) => item.collectionName === collectionName,
          );
          config.collectionList.splice(index, 1);
          return { ...config };
        });
        this.map.set(name, config!);
      }
      return result;
    }
    override async changeActivateCollection(
      name: string,
      collectionName: string,
    ): Promise<void> {
      await super.changeActivateCollection(name, collectionName);
      const config = this.map.get(name)!;
      config.update((config) => ({
        ...config,
        activateCollection: collectionName,
      }));
      this.map.set(name, config!);
    }
  };
  const size = 100;
  const parseMap = {
    doc: {
      entity: [{ name: 'n1', description: 'd1', type: '' }],
      entity_relation: [
        {
          source: 's1',
          target: 'd1',
          description: '',
          strength: 0,
          keywords: [''],
        },
      ],
      keyword: [''],
    } as EntityExtractType,
    标题: {
      entity: [],
      entity_relation: [],
      keyword: [''],
    } as EntityExtractType,
  } as Record<string, EntityExtractType>;
  const qdStart = withResolvers();
  return {
    service,
    dir: dir,
    qdStart,
    create: () =>
      createRootInjector({
        providers: [
          service,
          {
            provide: QdrantOptionsToken,
            useValue: signal({
              host: '127.0.0.1',
              port: 5432,
            }),
          },
          { provide: QdrantStartToken, useValue: qdStart },
          { provide: OCRToken, useValue: envConfig?.ocr ?? (async () => '') },
          {
            provide: LogToken,
            useValue: envConfig?.log ?? {
              info: () => {},
              warn: () => {},
              error: () => {},
            },
          },
          {
            provide: TextSplitterToken,
            useValue:
              envConfig?.textSplitter ??
              ((async (content, metadata) => {
                const a = new RecursiveCharacterTextSplitter({
                  chunkOverlap: 20,
                  separators: [''],
                  keepSeparator: false,
                });
                const result = await a.createDocuments([content], [metadata]);
                return result;
              }) as TextSplitter),
          },
          {
            provide: Text2VecToken,
            useValue:
              envConfig?.text2Vec ??
              ((async (str, collectionName) => {
                if (
                  collectionName.includes('激活') ||
                  collectionName.includes('定义')
                ) {
                  throw new Error('文本嵌入传入集合名异常');
                }
                if (typeof str === 'string') {
                  return new Array(
                    collectionSizeMap[collectionName] ?? size,
                  ).fill(0);
                } else {
                  return str.map((item) =>
                    new Array(collectionSizeMap[collectionName] ?? size).fill(
                      0,
                    ),
                  );
                }
              }) as Text2Vec),
          },
          {
            provide: ReRankerToken,
            useValue: {
              run: async (arg: any) => {
                expect(arg.docs[0]).not.eq(null);
                expect(arg.docs[0]).not.eq(undefined);
                return (arg.docs as any[]).map((item, index) => ({
                  score: 1,
                  index,
                }));
              },
              getQueryRatio: () => 5,
            },
          },
          {
            provide: ContentParserToken,
            useValue: {
              parse:
                envConfig?.contentParser ??
                (async (chunk: any) => parseMap[chunk.fileName]),
            },
          },
        ],
      }),
  };
}
export type TestManager = InstanceType<
  Awaited<ReturnType<typeof createManager>>['service']
>;
