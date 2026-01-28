import { createModelDataContext } from '../../src'

export type Post = {
  id: number
  title: string
  likes: number
}

export const postContext = createModelDataContext<Post>({
  name: 'post',
  defaultScope: 'local',
})
