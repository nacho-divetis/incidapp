import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './Textarea';

// El átomo no lleva etiqueta: en las stories se le da un nombre accesible con `aria-label`.
const meta = {
  title: 'Átomos/Textarea',
  component: Textarea,
  args: { 'aria-label': 'Descripción', placeholder: 'Describe lo que ocurre' },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const Deshabilitado: Story = { args: { disabled: true, defaultValue: 'No editable' } };
export const ConError: Story = { args: { invalid: true } };
