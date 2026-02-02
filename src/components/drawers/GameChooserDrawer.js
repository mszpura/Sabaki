import {h, Component} from 'preact'
import classNames from 'classnames'

import MiniGoban from '../MiniGoban.js'
import Drawer from './Drawer.js'

import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import * as dialog from '../../modules/dialog.js'
import * as fileformats from '../../modules/fileformats/index.js'
import * as gametree from '../../modules/gametree.js'
import * as gamesort from '../../modules/gamesort.js'
import * as helper from '../../modules/helper.js'

const t = i18n.context('GameChooserDrawer')
const setting = {get: (key) => window.sabaki.setting.get(key)}

let thumbnailSize = setting.get('gamechooser.thumbnail_size')
let itemMinWidth = thumbnailSize + 12 + 20
let itemHeight = 253 + 10 + 20

let getPreviewBoard = (tree) => {
  let node = tree.navigate(tree.root.id, 30, {})
  if (!node)
    node = tree.navigate(tree.root.id, tree.getCurrentHeight({}) - 1, {})

  return gametree.getBoard(tree, node.id)
}

class GameListItem extends Component {
  constructor() {
    super()

    let events = ['Click', 'ContextMenu', 'DragStart', 'DragOver']

    for (let name of events) {
      this[`handle${name}`] = (evt) => {
        let callback = this.props[`on${name}`]
        evt.tree = this.props.tree
        if (callback) callback(evt)
      }
    }
  }

  shouldComponentUpdate(nextProps) {
    for (let i in nextProps) if (nextProps[i] !== this.props[i]) return true

    return false
  }

  render({
    tree,
    directoryName,
    left,
    top,
    draggable,
    showThumbnail,
    insertBefore,
    insertAfter,
  }) {
    let gameInfo = gametree.getGameInfo(tree)
    let {gameName, eventName, blackName, blackRank, whiteName, whiteRank} =
      gameInfo
    let name = gameName || eventName || ''
    let directoryLabel = directoryName ? `${directoryName} / ` : ''
    let displayName = `${directoryLabel}${name}`.trim()

    return h(
      'li',
      {
        ref: (el) => (this.element = el),
        class: classNames({
          insertbefore: insertBefore,
          insertafter: insertAfter,
        }),
        style: {left, top},
      },

      h(
        'div',
        {
          draggable,
          onClick: this.handleClick,
          onContextMenu: this.handleContextMenu,
          onDragStart: this.handleDragStart,
          onDragOver: this.handleDragOver,
        },

        h('span', {title: displayName}, displayName),

        h(MiniGoban, {
          board: getPreviewBoard(tree),
          maxSize: thumbnailSize,
          visible: showThumbnail,
        }),

        h('span', {class: 'black', title: blackRank}, blackName || t('Black')),
        h('span', {class: 'white', title: whiteRank}, whiteName || t('White')),
      ),
    )
  }
}

export default class GameChooserDrawer extends Component {
  constructor() {
    super()

    this.itemElements = {}

    this.state = {
      scrollTop: 0,
      insertBefore: -1,
      animation: false,
      filterText: '',
      directoryFilterId: 'all',
    }

    this.handleFilterTextChange = (evt) =>
      this.setState({
        filterText: evt.currentTarget.value.trim(),
      })

    this.handleCloseButtonClick = () => sabaki.closeDrawer()

    this.getDirectoryId = (tree) => {
      let {gameTreeDirectories = {}} = this.props
      let directoryId = gameTreeDirectories[String(tree.id)]

      return directoryId == null ? null : directoryId
    }

    this.getDirectoryName = (tree) => {
      let {gameDirectories = [], gameTreeDirectories = {}} = this.props
      let directoryId = gameTreeDirectories[String(tree.id)]
      let directory = gameDirectories.find((dir) => dir.id === directoryId)

      return directory ? directory.name : null
    }

    this.handleDirectoryFilterChange = (evt) => {
      this.setState({directoryFilterId: evt.currentTarget.value})
    }

    this.handleCreateDirectory = async () => {
      let name = await dialog.showInputBox(t('Enter directory name'))
      if (name == null) return null

      name = name.trim()
      if (name === '') return null

      let {gameDirectories = [], onChange = helper.noop} = this.props
      let newDirectory = {id: helper.getId(), name}
      let newGameDirectories = [...gameDirectories, newDirectory]

      onChange({gameDirectories: newGameDirectories})

      sabaki.flashInfoOverlay(t('Directory created'))

      return newDirectory.id
    }

    this.updateTreeDirectory = (tree, directoryId) => {
      let {gameTreeDirectories = {}, onChange = helper.noop} = this.props
      let newGameTreeDirectories = {...gameTreeDirectories}

      if (directoryId == null) {
        delete newGameTreeDirectories[String(tree.id)]
      } else {
        newGameTreeDirectories[String(tree.id)] = directoryId
      }

      onChange({gameTreeDirectories: newGameTreeDirectories})
    }

    this.handleListScroll = (evt) => {
      this.setState({scrollTop: evt.currentTarget.scrollTop})
    }

    this.handleItemContextMenu = (evt) => {
      let {gameDirectories = [], gameTreeDirectories = {}} = this.props
      let currentDirectoryId = gameTreeDirectories[String(evt.tree.id)] || null

      let directorySubmenu = [
        {
          label: t('No Directory'),
          type: 'radio',
          checked: currentDirectoryId == null,
          click: () => this.updateTreeDirectory(evt.tree, null),
        },
        ...(gameDirectories.length > 0 ? [{type: 'separator'}] : []),
        ...gameDirectories.map((directory) => ({
          label: directory.name,
          type: 'radio',
          checked: directory.id === currentDirectoryId,
          click: () => this.updateTreeDirectory(evt.tree, directory.id),
        })),
        {type: 'separator'},
        {
          label: t('New Directory…'),
          click: async () => {
            let newId = await this.handleCreateDirectory()
            if (newId != null) this.updateTreeDirectory(evt.tree, newId)
          },
        },
      ]

      helper.popupMenu(
        [
          {
            label: t('Move to Directory'),
            submenu: directorySubmenu,
          },
          {type: 'separator'},
          {
            label: t('&Remove Game'),
            click: async () => {
              if (
                (await dialog.showMessageBox(
                  t('Do you really want to remove this game permanently?'),
                  'warning',
                  [t('Remove Game'), t('Cancel')],
                  1,
                )) === 1
              )
                return

              let {
                gameTrees,
                gameTreeDirectories = {},
                onChange = helper.noop,
              } = this.props
              let index = gameTrees.indexOf(evt.tree)
              let newGameTreeDirectories = {...gameTreeDirectories}
              delete newGameTreeDirectories[String(evt.tree.id)]

              onChange({
                gameTrees: gameTrees.filter((_, i) => i !== index),
                gameTreeDirectories: newGameTreeDirectories,
              })
            },
          },
          {
            label: t('Remove &Other Games'),
            click: async () => {
              if (
                (await dialog.showMessageBox(
                  t(
                    'Do you really want to remove all other games permanently?',
                  ),
                  'warning',
                  [t('Remove Games'), t('Cancel')],
                  1,
                )) === 1
              )
                return

              let {gameTreeDirectories = {}, onChange = helper.noop} =
                this.props
              let directoryId = gameTreeDirectories[String(evt.tree.id)] || null
              let newGameTreeDirectories = {}

              if (directoryId != null) {
                newGameTreeDirectories[String(evt.tree.id)] = directoryId
              }

              onChange({
                gameTrees: [evt.tree],
                gameTreeDirectories: newGameTreeDirectories,
              })
            },
          },
        ],
        evt.clientX,
        evt.clientY,
      )
    }

    this.handleItemDragStart = (evt) => {
      this.dragData = this.props.gameTrees.indexOf(evt.tree)
    }

    this.handleItemDragOver = (evt) => {
      if (this.dragData == null) return

      evt.preventDefault()

      let element = evt.currentTarget
      let index = this.props.gameTrees.indexOf(evt.tree)

      let x = evt.clientX
      let {left, width} = element.getBoundingClientRect()
      let middle = left + width / 2

      if (x <= middle - 10) {
        this.setState({insertBefore: index})
      } else if (x >= middle + 10) {
        this.setState({insertBefore: index + 1})
      }
    }

    this.handleItemDrop = (evt) => {
      let {gameTrees, onChange = helper.noop} = this.props
      let {insertBefore} = this.state
      let newGameTrees = gameTrees.slice()

      if (this.dragData == null || insertBefore < 0) return
      if (insertBefore > this.dragData) insertBefore--

      let [tree] = newGameTrees.splice(this.dragData, 1)
      newGameTrees.splice(insertBefore, 0, tree)

      this.dragData = null
      this.setState({insertBefore: -1})

      onChange({gameTrees: newGameTrees})
    }

    this.handleCancelDrag = () => {
      this.dragData = null
      this.setState({insertBefore: -1})
    }

    this.handleItemClick = (evt) => {
      let {onItemClick = helper.noop} = this.props

      evt.selectedTree = evt.tree
      onItemClick(evt)
    }

    this.handleAddButtonClick = (evt) => {
      let template = [
        {
          label: t('Add &New Game'),
          click: () => {
            let tree = sabaki.getEmptyGameTree()
            let {gameTrees, onChange = helper.noop} = this.props

            onChange({gameTrees: [...gameTrees, tree]})
          },
        },
        {
          label: t('Add &New Directory…'),
          click: async () => {
            await this.handleCreateDirectory()
          },
        },
        {
          label: t('Add &Existing Files…'),
          click: async () => {
            let result = await dialog.showOpenDialog({
              properties: ['openFile', 'multiSelections'],
              filters: [
                ...fileformats.meta,
                {name: t('All Files'), extensions: ['*']},
              ],
            })
            let {gameTrees, onChange = helper.noop} = this.props
            let newTrees = []

            sabaki.setBusy(true)

            if (result) {
              try {
                for (let filename of result) {
                  let trees = fileformats.parseFile(filename)
                  newTrees.push(...trees)
                }
              } catch (err) {
                await dialog.showMessageBox(
                  t('Some files are unreadable.'),
                  'warning',
                )
              }
            }

            onChange({gameTrees: [...gameTrees, ...newTrees]})
            sabaki.setBusy(false)
          },
        },
      ]

      let element = evt.currentTarget
      let {left, bottom} = element.getBoundingClientRect()

      helper.popupMenu(template, left, bottom)
    }

    this.handleSortButtonClick = (evt) => {
      let sortWith = (sorter) => () => {
        sabaki.setBusy(true)

        let {gameTrees, onChange = helper.noop} = this.props
        let newGameTrees = sorter(gameTrees.slice())

        onChange({gameTrees: newGameTrees})
        sabaki.setBusy(false)
      }

      let sortByDirectory = () => {
        sabaki.setBusy(true)

        let {
          gameTrees,
          gameDirectories = [],
          gameTreeDirectories = {},
          onChange = helper.noop,
        } = this.props
        let directoryNames = new Map(
          gameDirectories.map((directory) => [directory.id, directory.name]),
        )

        let getDirectoryName = (tree) =>
          directoryNames.get(gameTreeDirectories[String(tree.id)]) || ''

        let newGameTrees = gameTrees.slice().sort((a, b) => {
          let dirA = getDirectoryName(a).toLowerCase()
          let dirB = getDirectoryName(b).toLowerCase()
          if (dirA !== dirB) return dirA.localeCompare(dirB)

          let nameA = gametree.getGameInfo(a).gameName || ''
          let nameB = gametree.getGameInfo(b).gameName || ''
          return nameA.toLowerCase().localeCompare(nameB.toLowerCase())
        })

        onChange({gameTrees: newGameTrees})
        sabaki.setBusy(false)
      }

      let template = [
        {label: t('&Black Player'), click: sortWith(gamesort.byPlayerBlack)},
        {label: t('&White Player'), click: sortWith(gamesort.byPlayerWhite)},
        {label: t('Black R&ank'), click: sortWith(gamesort.byBlackRank)},
        {label: t('White Ran&k'), click: sortWith(gamesort.byWhiteRank)},
        {label: t('Game &Name'), click: sortWith(gamesort.byGameName)},
        {label: t('Game &Event'), click: sortWith(gamesort.byEvent)},
        {label: t('Game &Directory'), click: sortByDirectory},
        {label: t('&Date'), click: sortWith(gamesort.byDate)},
        {
          label: t('Number of &Moves'),
          click: sortWith(gamesort.byNumberOfMoves),
        },
        {type: 'separator'},
        {label: t('&Reverse'), click: sortWith(gamesort.reverse)},
      ]

      let element = evt.currentTarget
      let {left, bottom} = element.getBoundingClientRect()

      helper.popupMenu(template, left, bottom)
    }
  }

  componentDidMount() {
    window.addEventListener('resize', () => this.resize())

    this.resize()
    this.forceUpdate()
  }

  shouldComponentUpdate({show}, {animation}) {
    return (
      animation !== this.state.animation || show || show !== this.props.show
    )
  }

  async componentDidUpdate(prevProps, prevState) {
    if (
      this.state.scrollTop !== prevState.scrollTop &&
      this.state.scrollTop !== this.gamesListElement.scrollTop
    ) {
      // Update scroll top

      this.gamesListElement.scrollTop = this.state.scrollTop
      this.setState({scrollTop: this.gamesListElement.scrollTop})
    }

    if (
      this.props.show &&
      prevProps.gameTrees.length < this.props.gameTrees.length
    ) {
      // Scroll down

      this.gamesListElement.scrollTop = this.gamesListElement.scrollHeight
      this.setState({scrollTop: this.gamesListElement.scrollTop})
    }

    if (!prevProps.show && this.props.show) {
      // Scroll current list element into view

      await this.resize()

      let index = this.shownGameTrees.findIndex(
        ([, i]) => i === this.props.gameIndex,
      )
      let scrollTop = 0
      if (index >= 0) scrollTop = this.getRowFromIndex(index) * itemHeight

      this.gamesListElement.scrollTop = scrollTop
      this.setState({scrollTop: this.gamesListElement.scrollTop})
    }

    if (prevProps.show !== this.props.show) {
      // Animate

      let gobanRect = document.getElementById('goban').getBoundingClientRect()
      let drawerRect = document
        .getElementById('gamechooser')
        .getBoundingClientRect()

      let itemElement = this.itemElements[this.props.gameIndex]
      let svgElement =
        itemElement != null ? itemElement.querySelector('svg') : null

      if (itemElement != null && svgElement != null) {
        let {width, height, left, top} = itemElement
          .querySelector('svg')
          .getBoundingClientRect()

        let miniGobanRect = {
          left: left - drawerRect.left,
          top: top - drawerRect.top,
          width,
          height,
        }

        let direction = this.props.show ? 'reverse' : 'normal'

        this.setState({animation: [miniGobanRect, gobanRect, direction]})
        setTimeout(() => this.setState({animation: null}), 600)
      }
    }
  }

  async resize() {
    let innerWidth = this.gamesListElement.offsetWidth - 28
    let height = this.gamesListElement.offsetHeight
    let rowCount = Math.floor(innerWidth / itemMinWidth)

    return new Promise((resolve) => {
      this.setState({innerWidth, height, rowCount}, resolve)
    })
  }

  getRowFromIndex(i) {
    return (i - (i % this.state.rowCount)) / this.state.rowCount
  }

  render(
    {show, gameTrees, gameIndex},
    {
      filterText,
      directoryFilterId,
      animation,
      scrollTop,
      insertBefore,
      rowCount,
      innerWidth,
      height,
    },
  ) {
    let itemWidth = Math.floor(innerWidth / rowCount)

    this.shownGameTrees = gameTrees
      .map((tree, index) => {
        return [
          tree,
          index,
          this.getDirectoryName(tree),
          this.getDirectoryId(tree),
        ]
      })
      .filter(([tree, , directoryName, directoryId]) => {
        let gameInfo = gametree.getGameInfo(tree)
        let data = Object.keys(gameInfo).map((x) => gameInfo[x])

        let matchesFilter =
          directoryFilterId === 'all' ||
          (directoryFilterId === 'none' && directoryId == null) ||
          String(directoryId) === directoryFilterId

        return (
          matchesFilter &&
          data
            .concat([directoryName || ''])
            .join(' ')
            .toLowerCase()
            .includes(filterText.toLowerCase())
        )
      })

    return h(
      'div',
      {onDrop: this.handleCancelDrag},
      h(
        'style',
        {},
        `#gamechooser .games-list .placeholder {
          height: ${
            (this.getRowFromIndex(this.shownGameTrees.length - 1) + 1) *
              itemHeight +
            20
          }px;
        }

        #gamechooser .games-list li {
          width: ${itemWidth - 20}px;
        }`,
        animation &&
          `#gamechooser-animation {
            animation: gamechooser-animation .5s ${animation[2]} forwards;
          }

          @keyframes gamechooser-animation {
            from {
              transform: translate(
                ${animation[0].left}px,
                ${animation[0].top}px
              );
              opacity: 1;
            }
            to {
              transform:
                translate(
                  ${animation[1].left}px,
                  ${animation[1].top}px
                )
                scale(
                  ${animation[1].width / animation[0].width},
                  ${animation[1].height / animation[0].height}
                );
              opacity: 0;
            }
          }`,
      ),

      h(
        Drawer,
        {
          type: 'gamechooser',
          show,
        },

        h('h2', {}, t('Manage Games')),

        h('input', {
          type: 'search',
          name: 'filter',
          placeholder: t('Filter'),
          value: filterText,
          onInput: this.handleFilterTextChange,
        }),

        h(
          'select',
          {
            class: 'directory-filter',
            value: directoryFilterId,
            onChange: this.handleDirectoryFilterChange,
          },
          h('option', {value: 'all'}, t('All Directories')),
          h('option', {value: 'none'}, t('Unassigned')),
          (this.props.gameDirectories || []).map((directory) =>
            h(
              'option',
              {value: String(directory.id), key: directory.id},
              directory.name,
            ),
          ),
        ),

        h(
          'div',
          {
            ref: (el) => (this.gamesListElement = el),
            class: 'games-list',

            onScroll: this.handleListScroll,
            onDrop: this.handleItemDrop,
          },

          h('div', {class: 'placeholder'}),

          h(
            'ol',
            {},
            this.shownGameTrees.map(([tree, index, directoryName], i) => {
              let row = this.getRowFromIndex(i)
              let itemTop = row * itemHeight + 10
              let itemLeft = (i - row * rowCount) * itemWidth + 10

              if (
                index !== gameIndex &&
                (itemTop + itemHeight * 2 <= scrollTop ||
                  itemTop - itemHeight >= scrollTop + height)
              )
                return

              return h(GameListItem, {
                ref: (item) =>
                  (this.itemElements[index] =
                    item == null ? null : item.element),
                key: tree.id,
                tree,
                directoryName,
                top: itemTop,
                left: itemLeft,
                draggable: filterText === '',

                showThumbnail: index !== gameIndex || !animation,
                insertBefore: insertBefore === index,
                insertAfter:
                  i === this.shownGameTrees.length - 1 &&
                  insertBefore === index + 1,

                onClick: this.handleItemClick,
                onContextMenu: this.handleItemContextMenu,
                onDragStart: this.handleItemDragStart,
                onDragOver: this.handleItemDragOver,
              })
            }),
          ),
        ),

        h(
          'p',
          {},
          h(
            'button',
            {
              type: 'button',
              class: 'dropdown',
              onClick: this.handleAddButtonClick,
            },
            t('Add'),
          ),

          h(
            'button',
            {
              type: 'button',
              class: 'dropdown',
              onClick: this.handleSortButtonClick,
            },
            t('Sort By'),
          ),

          h(
            'button',
            {
              type: 'button',
              onClick: this.handleCloseButtonClick,
            },
            t('Close'),
          ),
        ),
      ),

      h(
        'div',
        {
          id: 'gamechooser-animation',
          style: !animation
            ? {
                opacity: 0,
                pointerEvents: 'none',
              }
            : {},
        },

        h(MiniGoban, {
          board: getPreviewBoard(gameTrees[gameIndex]),
          maxSize: thumbnailSize,
        }),
      ),
    )
  }
}
