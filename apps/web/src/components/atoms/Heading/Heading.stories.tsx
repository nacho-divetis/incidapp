import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heading } from './Heading';

const meta = {
  title: 'Átomos/Heading',
  component: Heading,
  args: { children: 'Incidencias abiertas' },
  argTypes: {
    level: { control: 'inline-radio', options: [1, 2, 3, 4] },
    as: { control: 'select', options: [undefined, 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'] },
  },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Nivel1: Story = { args: { level: 1 } };
export const Nivel2: Story = { args: { level: 2 } };
export const Nivel3: Story = { args: { level: 3 } };
export const Nivel4: Story = { args: { level: 4 } };
/** Un `h1` con el tamaño del nivel 3 (`as` separa la semántica del aspecto). */
export const SemánticaDistinta: Story = { args: { level: 3, as: 'h1' } };

/** La escala completa, en orden jerárquico. */
export const Escala: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {([1, 2, 3, 4] as const).map((level) => (
        <Heading key={level} {...args} level={level}>
          Título de nivel {level}
        </Heading>
      ))}
    </div>
  ),
};
